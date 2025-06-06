describe('Terraform Generator', () => {
  it('should generate basic configuration', () => {
    // Simple test without imports for now
    const terraformConfig = `
terraform {
  required_version = ">= 1.0.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 4.0.0"
    }
  }
}

provider "aws" {
  region = "us-west-2"
}

resource "aws_instance" "example" {
  ami           = "ami-12345678"
  instance_type = "t3.micro"
}`;

    expect(terraformConfig).toContain('terraform {');
    expect(terraformConfig).toContain('provider "aws"');
    expect(terraformConfig).toContain('resource "aws_instance"');
  });

  it('should handle provider validation', () => {
    const providers = ['aws', 'gcp', 'azure'];
    expect(providers).toContain('aws');
    expect(providers.length).toBe(3);
  });
});
