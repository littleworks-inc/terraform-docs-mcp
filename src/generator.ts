// Simple stub for generator.ts if it doesn't exist
export interface SchemaAttribute {
  description: string;
  required: boolean;
  type?: string;
  nested?: Record<string, SchemaAttribute>;
}

export interface Schema {
  attributes: Record<string, SchemaAttribute>;
}

export function generateTerraformConfig(
  provider: string,
  resource: string,
  schema: Schema,
  attributes: Record<string, any> = {}
): string {
  return `# Generated Terraform configuration for ${provider}_${resource}
resource "${provider}_${resource}" "example" {
  # Add your configuration here
}`;
}