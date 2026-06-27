import os
import re

def fix_imports(directory="src"):
    """
    Diagnoses and fixes the 'image/' to 'images/' path mismatch causing build failures.
    It updates all import references in the source files to match the actual file system.
    """
    print(f"Diagnosing broken imports in {directory}...")
    fixed_files = []
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                filepath = os.path.join(root, file)
                
                with open(filepath, 'r', encoding='utf-8') as f:
                    original_content = f.read()
                
                # 1. Update general 'image/' references to 'images/'
                content = re.sub(r'([\'"`])((?:\.\.\/|\.\/)+)image/', r'\g<1>\g<2>images/', original_content)
                content = re.sub(r'([\'"`])@/image/', r'\g<1>@/images/', content)
                
                # 2. Re-align branding image (mission-control-full.jpeg) to its actual directory: 'assets/branding/'
                # (Based on the uploaded file structure `src/assets/branding/mission-control-full.jpeg`)
                content = re.sub(r'([\'"`])((?:\.\.\/|\.\/)+)(images?)/branding/', r'\g<1>\g<2>assets/branding/', content)
                content = re.sub(r'([\'"`])@/images?/branding/', r'\g<1>@/assets/branding/', content)

                if content != original_content:
                    with open(filepath, 'w', encoding='utf-8') as f:
                        f.write(content)
                    fixed_files.append(filepath)

    return fixed_files

if __name__ == "__main__":
    changed = fix_imports()
    if changed:
        print(f"Build Failure Fixed. Updated {len(changed)} file(s):")
        for f in changed:
            print(f" - {f}")
    else:
        print("No broken image paths found in the src directory.")