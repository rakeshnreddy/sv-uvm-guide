import { z } from 'zod';

const featureFlagsSchema = z.object({
  // Set to true to enable community features (comments, user profiles, etc.)
  community: z.boolean().default(false),
  // Set to true to enable user progress tracking and assessments
  tracking: z.boolean().default(false),
  // Set to true to enable personalization features (e.g., recommended content)
  personalization: z.boolean().default(false),
  // Set to true to show mock comment sections
  fakeComments: z.boolean().default(false),
  // Set to true to show user account UI elements (e.g., avatar, login button)
  accountUI: z.boolean().default(false),
});

export type FeatureFlags = z.infer<typeof featureFlagsSchema>;

// TODO: Implement a proper remote config system (e.g., using environment variables or a service)
const flags: FeatureFlags = {
  community: false,
  tracking: false,
  personalization: false,
  fakeComments: false,
  accountUI: false,
};

export const featureFlags = featureFlagsSchema.parse(flags);

export const isFeatureEnabled = (flag: keyof FeatureFlags) => {
  return featureFlags[flag];
};
