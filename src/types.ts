export interface Student {
  id: string;
  name: string;
  currentLives: number;
  totalPoints: number;
}

export interface ClassData {
  className: string;
  classLevel: string;
  maxLives: number;
  meetingNumber: number;
  students: Student[];
}
