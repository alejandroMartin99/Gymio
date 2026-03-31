export interface WorkoutRecord {
  id: string;
  workout_name: string;
  routine_types: string[];
  notes?: string | null;
  created_at: string;
}
