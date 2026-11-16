declare module "gltf-validator" {
  export function validateBytes(data: Uint8Array, options: { format: "glb"; maxIssues: number }): Promise<{
    issues: { numErrors: number; messages: { code: string; severity: number; pointer?: string }[] };
  }>;
}
