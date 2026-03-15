import { SessionOptions } from 'iron-session';

const sessionPassword = process.env.SESSION_SECRET;

if (!sessionPassword && process.env.NODE_ENV === 'production') {
  throw new Error(
    "SESSION_SECRET must be set in production to ensure secure sessions.",
  );
}

export const sessionOptions: SessionOptions = {
  password: sessionPassword || 'test-secret-development-key-that-is-32-bytes-long',
  cookieName: 'iron-session/examples/next.js',
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
