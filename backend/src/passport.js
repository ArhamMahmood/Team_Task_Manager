import passport from 'passport';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcrypt';
import { findUserByEmail, findUserById } from './repos/users.js';

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    async (email, password, done) => {
      try {
        const user = await findUserByEmail(email);

        // Always run a comparison so a missing account and a wrong password
        // take a similar amount of time (valid dummy hash of a random value).
        const hash =
          user?.passwordHash ?? '$2b$12$tmUWqP02q8UlI/6ShEgYiOopoSNYvqka5sPOuPQcMf0TyDchVQWiW';
        const matches = await bcrypt.compare(password, hash);

        if (!user || !matches) {
          return done(null, false, { message: 'Invalid email or password.' });
        }

        return done(null, { id: user.id, name: user.name, email: user.email });
      } catch (err) {
        return done(err);
      }
    },
  ),
);

// Only the user id is stored in the session.
passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await findUserById(id);
    done(null, user ?? false);
  } catch (err) {
    done(err);
  }
});

export default passport;
