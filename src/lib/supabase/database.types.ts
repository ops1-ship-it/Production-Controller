export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Row<T> = T;
type Insert<T> = Partial<T>;
type Update<T> = Partial<T>;

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Row<{
          id: string;
          full_name: string | null;
          email: string | null;
          avatar_url: string | null;
          default_business_id: string | null;
          default_location_id: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["profiles"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["profiles"]["Row"]>;
      };
      businesses: {
        Row: Row<{
          id: string;
          name: string;
          business_code: string | null;
          currency_code: string;
          vat_percentage: number;
          timezone: string;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["businesses"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["businesses"]["Row"]>;
      };
      business_users: {
        Row: Row<{
          id: string;
          business_id: string;
          user_id: string;
          role: string;
          is_active: boolean;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["business_users"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["business_users"]["Row"]>;
      };
      locations: {
        Row: Row<{
          id: string;
          business_id: string;
          name: string;
          location_code: string | null;
          timezone: string | null;
          address: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["locations"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["locations"]["Row"]>;
      };
      location_users: {
        Row: Row<{
          id: string;
          location_id: string;
          user_id: string;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["location_users"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["location_users"]["Row"]>;
      };
      ingredient_categories: {
        Row: Row<{
          id: string;
          business_id: string | null;
          name: string;
          description: string | null;
          is_active: boolean;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["ingredient_categories"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["ingredient_categories"]["Row"]>;
      };
      suppliers: {
        Row: Row<{
          id: string;
          business_id: string | null;
          name: string;
          contact_name: string | null;
          email: string | null;
          phone: string | null;
          notes: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["suppliers"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["suppliers"]["Row"]>;
      };
      ingredients: {
        Row: Row<{
          id: string;
          business_id: string;
          category_id: string | null;
          supplier_id: string | null;
          name: string;
          description: string | null;
          sku: string | null;
          purchase_quantity: number;
          purchase_uom: string;
          purchase_cost: number;
          recipe_base_uom: string;
          cost_per_base_unit: number;
          default_wastage_percentage: number;
          notes: string | null;
          is_active: boolean;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["ingredients"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["ingredients"]["Row"]>;
      };
      recipes: {
        Row: Row<{
          id: string;
          business_id: string;
          name: string;
          recipe_code: string | null;
          category: string | null;
          description: string | null;
          status: string;
          current_version_number: number;
          created_by: string | null;
          created_at: string;
          updated_at: string;
          archived_at: string | null;
        }>;
        Insert: Insert<Database["public"]["Tables"]["recipes"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["recipes"]["Row"]>;
      };
      recipe_versions: {
        Row: Row<{
          id: string;
          recipe_id: string;
          version_number: number;
          main_ingredient_id: string | null;
          base_main_quantity: number;
          base_main_uom: string;
          expected_yield: number | null;
          expected_yield_uom: string | null;
          expected_yield_percentage: number | null;
          expected_production_loss: number | null;
          formula_ingredient_cost: number;
          estimated_additional_cost: number;
          expected_total_cost: number;
          expected_cost_per_yield_unit: number | null;
          default_selling_unit_quantity: number | null;
          default_selling_unit_uom: string | null;
          default_pricing_method: string | null;
          default_pricing_percentage: number | null;
          expected_selling_price: number | null;
          method_introduction: string | null;
          is_current: boolean;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["recipe_versions"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["recipe_versions"]["Row"]>;
      };
      recipe_formula_lines: {
        Row: Row<{
          id: string;
          recipe_version_id: string;
          ingredient_id: string;
          formula_quantity: number;
          formula_uom: string;
          converted_base_quantity: number;
          ingredient_cost_snapshot: number;
          line_cost: number;
          is_main_ingredient: boolean;
          is_optional: boolean;
          wastage_percentage: number;
          notes: string | null;
          sort_order: number;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["recipe_formula_lines"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["recipe_formula_lines"]["Row"]>;
      };
      recipe_method_steps: {
        Row: Row<{
          id: string;
          recipe_version_id: string;
          step_number: number;
          title: string | null;
          instructions: string;
          duration_minutes: number | null;
          temperature_value: number | null;
          temperature_uom: string | null;
          equipment: string | null;
          notes: string | null;
          image_path: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["recipe_method_steps"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["recipe_method_steps"]["Row"]>;
      };
      production_batches: {
        Row: Row<{
          id: string;
          business_id: string;
          location_id: string | null;
          batch_number: string;
          recipe_id: string;
          recipe_version_id: string;
          status: string;
          responsible_user_id: string | null;
          started_by: string | null;
          completed_by: string | null;
          start_datetime: string | null;
          end_datetime: string | null;
          main_ingredient_id: string | null;
          base_main_quantity: number;
          base_main_uom: string;
          actual_main_quantity: number;
          actual_main_uom: string;
          scaling_factor: number;
          starting_yield: number | null;
          starting_yield_uom: string | null;
          completed_yield: number | null;
          completed_yield_uom: string | null;
          yield_percentage: number | null;
          production_loss: number | null;
          production_loss_percentage: number | null;
          expected_ingredient_cost: number;
          actual_ingredient_cost: number;
          additional_cost: number;
          total_production_cost: number;
          selling_unit_quantity: number | null;
          selling_unit_uom: string | null;
          number_of_sellable_units: number | null;
          cost_per_selling_unit: number | null;
          pricing_method: string | null;
          pricing_percentage: number | null;
          recommended_selling_price_ex_vat: number | null;
          vat_percentage: number;
          recommended_selling_price_inc_vat: number | null;
          manual_selling_price: number | null;
          final_selling_price: number | null;
          expected_revenue: number | null;
          expected_gross_profit: number | null;
          actual_gross_margin: number | null;
          outcome_notes: string | null;
          quality_rating: number | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_batches"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_batches"]["Row"]>;
      };
      production_ingredient_lines: {
        Row: Row<{
          id: string;
          production_batch_id: string;
          ingredient_id: string;
          ingredient_name_snapshot: string;
          formula_quantity: number;
          formula_uom: string;
          calculated_quantity: number;
          calculated_uom: string;
          actual_quantity: number | null;
          actual_uom: string | null;
          quantity_variance: number | null;
          ingredient_cost_snapshot: number;
          expected_line_cost: number;
          actual_line_cost: number | null;
          cost_variance: number | null;
          notes: string | null;
          sort_order: number;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_ingredient_lines"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_ingredient_lines"]["Row"]>;
      };
      production_method_steps: {
        Row: Row<{
          id: string;
          production_batch_id: string;
          source_recipe_method_step_id: string | null;
          step_number: number;
          title: string | null;
          instructions: string;
          duration_minutes: number | null;
          temperature_value: number | null;
          temperature_uom: string | null;
          equipment: string | null;
          notes: string | null;
          completed: boolean;
          completed_at: string | null;
          completed_by: string | null;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_method_steps"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_method_steps"]["Row"]>;
      };
      production_additional_costs: {
        Row: Row<{
          id: string;
          production_batch_id: string;
          cost_type: string;
          description: string | null;
          quantity: number;
          rate: number;
          total_cost: number;
          notes: string | null;
          created_at: string;
          updated_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_additional_costs"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_additional_costs"]["Row"]>;
      };
      production_notes: {
        Row: Row<{
          id: string;
          production_batch_id: string;
          note_type: string;
          note: string;
          created_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_notes"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_notes"]["Row"]>;
      };
      production_images: {
        Row: Row<{
          id: string;
          production_batch_id: string;
          image_type: string | null;
          storage_path: string;
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_images"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_images"]["Row"]>;
      };
      recipe_images: {
        Row: Row<{
          id: string;
          recipe_id: string;
          image_type: string | null;
          storage_path: string;
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["recipe_images"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["recipe_images"]["Row"]>;
      };
      ingredient_images: {
        Row: Row<{
          id: string;
          ingredient_id: string;
          image_type: string | null;
          storage_path: string;
          caption: string | null;
          uploaded_by: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["ingredient_images"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["ingredient_images"]["Row"]>;
      };
      audit_logs: {
        Row: Row<{
          id: string;
          business_id: string | null;
          table_name: string;
          record_id: string | null;
          action: string;
          old_values: Json | null;
          new_values: Json | null;
          changed_by: string | null;
          changed_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["audit_logs"]["Row"]>;
      };
      ingredient_imports: {
        Row: Row<{
          id: string;
          business_id: string;
          file_name: string;
          file_type: string;
          import_mode: string;
          imported_by: string | null;
          imported_at: string;
          total_rows: number;
          added_rows: number;
          updated_rows: number;
          skipped_rows: number;
          invalid_rows: number;
          error_summary: string | null;
        }>;
        Insert: Insert<Database["public"]["Tables"]["ingredient_imports"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["ingredient_imports"]["Row"]>;
      };
      ingredient_import_rows: {
        Row: Row<{
          id: string;
          import_id: string;
          business_id: string;
          original_row_number: number;
          imported_values: Json;
          import_result: string;
          validation_message: string | null;
          created_at: string;
        }>;
        Insert: Insert<Database["public"]["Tables"]["ingredient_import_rows"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["ingredient_import_rows"]["Row"]>;
      };
      units_of_measure: {
        Row: Row<{
          code: string;
          label: string;
          uom_type: string;
          sort_order: number;
        }>;
        Insert: Insert<Database["public"]["Tables"]["units_of_measure"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["units_of_measure"]["Row"]>;
      };
      production_statuses: {
        Row: Row<{
          code: string;
          label: string;
          sort_order: number;
          is_terminal: boolean;
        }>;
        Insert: Insert<Database["public"]["Tables"]["production_statuses"]["Row"]>;
        Update: Update<Database["public"]["Tables"]["production_statuses"]["Row"]>;
      };
    };
    Views: Record<string, never>;
    Functions: {
      start_production_batch: {
        Args: {
          p_business_id: string;
          p_location_id: string | null;
          p_recipe_id: string;
          p_recipe_version_id: string | null;
          p_actual_main_quantity: number;
          p_actual_main_uom: string;
          p_start_datetime: string;
          p_responsible_user_id: string | null;
          p_notes: string | null;
        };
        Returns: Database["public"]["Tables"]["production_batches"]["Row"];
      };
      complete_production_batch: {
        Args: {
          p_production_batch_id: string;
          p_end_datetime: string;
          p_starting_yield: number;
          p_completed_yield: number;
          p_completed_yield_uom: string;
          p_completed_by: string | null;
          p_quality_rating: number | null;
          p_outcome_notes: string | null;
        };
        Returns: Database["public"]["Tables"]["production_batches"]["Row"];
      };
      user_has_business_access: {
        Args: { p_business_id: string };
        Returns: boolean;
      };
      user_has_location_access: {
        Args: { p_location_id: string };
        Returns: boolean;
      };
      user_has_role: {
        Args: { p_business_id: string; p_role: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
