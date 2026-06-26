-- Phase 3E - Project Groups Batch Creation

-- 1. create_project_groups_batch
CREATE OR REPLACE FUNCTION public.create_project_groups_batch(
    p_class_id uuid,
    p_groups jsonb
) RETURNS jsonb AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_class_owner uuid;
    v_group record;
    v_name_clean text;
    v_desc_clean text;
    v_max_order integer;
    v_created_groups jsonb := '[]'::jsonb;
    v_new_id uuid;
    v_names text[] := ARRAY[]::text[];
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = p_class_id;
    IF v_class_owner IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
    IF v_class_owner != v_teacher_id THEN RAISE EXCEPTION 'Not authorized for this class'; END IF;

    IF p_groups IS NULL OR jsonb_array_length(p_groups) = 0 THEN
        RAISE EXCEPTION 'Groups payload cannot be empty';
    END IF;

    IF jsonb_array_length(p_groups) > 20 THEN
        RAISE EXCEPTION 'The number of groups must be between 2 and 20.';
    END IF;

    -- Validate names and check duplicates within payload
    FOR v_group IN SELECT * FROM jsonb_to_recordset(p_groups) AS x(name text, description text, color_key text)
    LOOP
        v_name_clean := btrim(v_group.name);
        IF v_name_clean IS NULL OR length(v_name_clean) < 2 OR length(v_name_clean) > 60 THEN
            RAISE EXCEPTION 'Group name must be between 2 and 60 characters.';
        END IF;
        
        IF array_position(v_names, lower(v_name_clean)) IS NOT NULL THEN
            RAISE EXCEPTION 'Two generated groups have the same name.';
        END IF;
        v_names := array_append(v_names, lower(v_name_clean));
    END LOOP;

    -- Check conflicts with existing active groups
    IF EXISTS (
        SELECT 1 FROM public.project_groups
        WHERE class_id = p_class_id
        AND status = 'active'
        AND lower(name) = ANY(v_names)
    ) THEN
        RAISE EXCEPTION 'A group with this name already exists.';
    END IF;

    -- Get max display order
    SELECT COALESCE(MAX(display_order), 0) INTO v_max_order
    FROM public.project_groups
    WHERE class_id = p_class_id AND status = 'active';

    -- Insert groups
    FOR v_group IN SELECT * FROM jsonb_to_recordset(p_groups) AS x(name text, description text, color_key text)
    LOOP
        v_max_order := v_max_order + 1;
        
        INSERT INTO public.project_groups (
            class_id, created_by, name, description, color_key, display_order, status
        ) VALUES (
            p_class_id, v_teacher_id, btrim(v_group.name), 
            substring(btrim(COALESCE(v_group.description, '')), 1, 500), 
            COALESCE(v_group.color_key, 'gray'), v_max_order, 'active'
        ) RETURNING id INTO v_new_id;
        
        v_created_groups := v_created_groups || jsonb_build_object(
            'id', v_new_id,
            'name', btrim(v_group.name),
            'color_key', COALESCE(v_group.color_key, 'gray')
        );
    END LOOP;

    RETURN v_created_groups;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_project_groups_batch(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_groups_batch(uuid, jsonb) TO authenticated;

-- 2. create_and_distribute_project_groups
CREATE OR REPLACE FUNCTION public.create_and_distribute_project_groups(
    p_class_id uuid,
    p_groups jsonb,
    p_distribution jsonb
) RETURNS void AS $$
DECLARE
    v_teacher_id uuid := auth.uid();
    v_class_owner uuid;
    v_created_groups jsonb;
    v_group_map jsonb := '{}'::jsonb;
    v_dist_item record;
    v_resolved_group_id uuid;
    v_student_id uuid;
    v_final_distribution jsonb := '[]'::jsonb;
    v_new_group record;
    v_name_clean text;
    v_max_order integer;
    v_new_id uuid;
    v_names text[] := ARRAY[]::text[];
BEGIN
    IF v_teacher_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
    
    SELECT created_by INTO v_class_owner FROM public.classes WHERE id = p_class_id;
    IF v_class_owner IS NULL THEN RAISE EXCEPTION 'Class not found'; END IF;
    IF v_class_owner != v_teacher_id THEN RAISE EXCEPTION 'Not authorized for this class'; END IF;

    -- Create groups if provided
    IF p_groups IS NOT NULL AND jsonb_array_length(p_groups) > 0 THEN
        IF jsonb_array_length(p_groups) > 20 THEN
            RAISE EXCEPTION 'The number of groups must be between 2 and 20.';
        END IF;

        -- Validate
        FOR v_new_group IN SELECT * FROM jsonb_to_recordset(p_groups) AS x(temp_id text, name text) LOOP
            v_name_clean := btrim(v_new_group.name);
            IF v_name_clean IS NULL OR length(v_name_clean) < 2 OR length(v_name_clean) > 60 THEN
                RAISE EXCEPTION 'Group name must be between 2 and 60 characters.';
            END IF;
            IF array_position(v_names, lower(v_name_clean)) IS NOT NULL THEN
                RAISE EXCEPTION 'Two generated groups have the same name.';
            END IF;
            v_names := array_append(v_names, lower(v_name_clean));
        END LOOP;
        
        IF EXISTS (
            SELECT 1 FROM public.project_groups
            WHERE class_id = p_class_id
            AND status = 'active'
            AND lower(name) = ANY(v_names)
        ) THEN
            RAISE EXCEPTION 'A group with this name already exists.';
        END IF;

        SELECT COALESCE(MAX(display_order), 0) INTO v_max_order
        FROM public.project_groups
        WHERE class_id = p_class_id AND status = 'active';

        FOR v_new_group IN SELECT * FROM jsonb_to_recordset(p_groups) AS x(temp_id text, name text, description text, color_key text) LOOP
            v_max_order := v_max_order + 1;
            INSERT INTO public.project_groups (
                class_id, created_by, name, description, color_key, display_order, status
            ) VALUES (
                p_class_id, v_teacher_id, btrim(v_new_group.name), 
                substring(btrim(COALESCE(v_new_group.description, '')), 1, 500), 
                COALESCE(v_new_group.color_key, 'gray'), v_max_order, 'active'
            ) RETURNING id INTO v_new_id;
            
            -- add to map
            v_group_map := jsonb_set(v_group_map, ARRAY[v_new_group.temp_id], to_jsonb(v_new_id));
        END LOOP;
    END IF;

    -- Resolve distribution
    FOR v_dist_item IN SELECT * FROM jsonb_to_recordset(p_distribution) AS x(group_id text, student_ids jsonb) LOOP
        IF v_group_map ? v_dist_item.group_id THEN
            v_resolved_group_id := (v_group_map ->> v_dist_item.group_id)::uuid;
        ELSE
            v_resolved_group_id := v_dist_item.group_id::uuid;
        END IF;
        
        v_final_distribution := v_final_distribution || jsonb_build_object(
            'group_id', v_resolved_group_id,
            'student_ids', v_dist_item.student_ids
        );
    END LOOP;

    -- Apply distribution
    PERFORM public.apply_project_group_distribution(p_class_id, v_final_distribution);

END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.create_and_distribute_project_groups(uuid, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_and_distribute_project_groups(uuid, jsonb, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
