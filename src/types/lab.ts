export type LabStatus = 'available' | 'coming_soon' | 'archived';

export interface LabStep {
  id: string;
  title: string;
  instructions: string;
  starterCode: string;
}

export type LabAssetRole = 'guide' | 'starter' | 'solution' | 'metadata' | 'reference';

export interface LabAsset {
  path: string;
  fileName: string;
  role: LabAssetRole;
  language: string;
  content: string;
  editable: boolean;
}

export interface LabMetadata {
  id: string;
  title: string;
  description: string;
  owningModule: string;
  routeSlug: string; 
  prerequisites: string[]; // array of module IDs
  moduleHref?: string;
  assetLocation: string; // 'content/curriculum/labs/'
  status: LabStatus;
  graderType: 'systemverilog' | 'uvm' | 'custom' | 'none';
  steps: LabStep[];
}
