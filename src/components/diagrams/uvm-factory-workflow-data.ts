export interface FactoryWorkflowStep {
  name: string;
  type: 'registration' | 'creation' | 'override';
  description: string;
}

export const uvmFactoryWorkflowData: FactoryWorkflowStep[] = [
  {
    name: 'Registration',
    type: 'registration',
    description: 'A component or object is registered with the factory using `uvm_component_utils` or `uvm_object_utils` macros. This adds the type to the factory\'s lookup table.',
  },
  {
    name: 'Creation Request',
    type: 'creation',
    description: 'A component requests a new object or component from the factory using `type_id::create()`. The factory looks up the requested type in its table.',
  },
  {
    name: 'Type Override Check',
    type: 'override',
    description: 'The factory checks if there are any type overrides for the requested type. If an override exists, the factory will create an object of the override type instead.',
  },
  {
    name: 'Instance Override Check',
    type: 'override',
    description: 'The factory checks for instance-specific overrides. An instance override has a higher priority than a type override.',
  },
  {
    name: 'Object Creation',
    type: 'creation',
    description: 'The factory creates an instance of the final determined type (either the original requested type or an override type).',
  },
  {
    name: 'Return Handle',
    type: 'creation',
    description: 'The factory returns a handle to the newly created object or component.',
  },
];
