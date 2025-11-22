/// <reference types="node" />
/// <reference types="express" />

// Help VS Code resolve module typings during editor restarts or transient TS server
declare module 'firebase-admin';
declare module 'firebase-functions';

// If more modules signal missing types, add them here as temporary shims.
