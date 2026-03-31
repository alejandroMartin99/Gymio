export interface ExerciseCatalogItem {
  id: string;
  user_id?: string | null;
  name: string;
  muscle_group: string;
  icon_url?: string | null;
  icon_key?: string | null;
  instructions_url?: string | null;
  is_custom: boolean;
}
