export interface UvmComponent {
  id: string;
  name: string;
  type: string;
  description: string;
  parent?: string;
  children?: string[];
}

export interface UvmConnection {
  source: string;
  target: string;
  type: 'analysis';
  phase?: string;
  description: string;
}

export const uvmComponents: UvmComponent[] = [];
export const uvmConnections: UvmConnection[] = [];
