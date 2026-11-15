-- Per-user UI preferences: language and theme choices move from
-- browser localStorage to the account, so they persist and stay
-- consistent across browsers and devices. Both columns are nullable:
-- NULL means the user never picked a value, in which case the client
-- keeps its built-in defaults (VITE_UI_LANG / 'id' for language,
-- light for theme). Values are validated by PUT /users/me
-- (language: "en" | "id"; theme: "light" | "dark").

-- AlterTable
ALTER TABLE "User" ADD COLUMN "language" TEXT;
ALTER TABLE "User" ADD COLUMN "theme" TEXT;
