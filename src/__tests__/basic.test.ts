describe('Basic Test Suite', () => {
  it('should run basic arithmetic', () => {
    expect(1 + 1).toBe(2);
  });

  it('should handle strings', () => {
    const projectName = 'terraform-docs-mcp';
    expect(projectName).toContain('terraform');
    expect(projectName).toContain('mcp');
  });

  it('should handle objects', () => {
    const config = {
      provider: 'aws',
      resource: 'instance'
    };
    expect(config.provider).toBe('aws');
    expect(config.resource).toBe('instance');
  });
});
