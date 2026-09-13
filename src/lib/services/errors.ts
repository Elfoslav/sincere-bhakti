// Shared service error classes. Post and blog services previously redeclared
// these identically as separate classes, so an `instanceof` check against one
// module's copy never matched the other's. Import (and re-export) from here
// so error identity crosses the module boundary.
export class UnauthorizedError extends Error {
  name = "UnauthorizedError" as const;
}
export class NotFoundError extends Error {
  name = "NotFoundError" as const;
}
export class ForbiddenError extends Error {
  name = "ForbiddenError" as const;
}
export class ValidationError extends Error {
  name = "ValidationError" as const;
}
export class ConflictError extends Error {
  name = "ConflictError" as const;
}
