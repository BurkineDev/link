// `server-only` lève une erreur dès qu'il est importé hors d'un composant
// serveur — y compris sous Jest. Les modules qui l'importent (Prisma, Better
// Auth, la couche db/*) sont mockés dans les tests, mais rien n'empêche une
// route testée d'en importer un transitivement. Ici, il ne fait rien.
export {};
