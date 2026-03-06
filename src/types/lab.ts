export type LabStatus = 'available' | 'coming_soon' | 'archived';

export interface LabStep {
  id: string;
  title: string;
  instructions: string;
  starterCode: string;
}

export interface LabMetadata {
  id: string;
  title: string;
  description: string;
  owningModule: string;
  routeSlug: string; 
  prerequisites: string[]; // array of module IDs
  assetLocation: string; // 'labs/' or 'content/curriculum/labs/'
  status: LabStatus;
  graderType: 'systemverilog' | 'uvm' | 'custom' | 'none';
  steps: LabStep[];
}
