// Console-only strings — never sent in API responses.
export const LOG = {
  CONFIG: {
    load: (envFile: string) => `[Config] ✅ Loaded environment from: ${envFile}`,
    missing: (envFile: string) => `[Config] ⚠️ Missing environment file: ${envFile}`,
    loadError: (envFile: string) => `[Config] ❌ Unexpected error loading ${envFile}:`,
  },
}

export const SUCCESS = {
  GENERIC: {
    OK: 'Operation successful',
    CREATED: 'Data created successfully',
    UPDATED: 'Data updated successfully',
    DELETED: 'Data deleted successfully',
  },
  UTIL: {
    create: (name: string) => `Created ${name} successfully`,
    update: (name: string) => `Updated ${name} successfully`,
    delete: (name: string) => `Deleted ${name} successfully`,
    save: (name: string) => `Saved ${name} successfully`,
    upload: (name: string) => `Uploaded ${name} successfully`,
  },
}

export const ERRORS = {
  GENERIC: {
    VALIDATION_ERROR: 'An unexpected error occurred during request validation',
    BAD_REQUEST: 'Bad request',
    UNAUTHORIZED: 'Unauthorized',
    FORBIDDEN: 'Forbidden',
    NOT_FOUND: 'Not found',
    INTERNAL_SERVER_ERROR: 'Internal server error',
    METHOD_NOT_ALLOWED: 'Method not allowed',
    TOO_MANY_REQUESTS: 'Too many requests. Please try again later',
    BAD_GATEWAY: 'Bad gateway',
    UNSPECIFIED_FUNCTION: 'Unspecified function',
    INVALID_JSON_BODY: 'Invalid JSON in request body',
  },
  UTIL: {
    notFound: (item: string) => `${item} not found`,
    alreadyExists: (item: string) => `${item} already exists`,
    invalidField: (field: string) => `Invalid ${field} format`,
    invalidType: (field: string, type: string) => `${field} must be of type ${type}`,
    requiredField: (field: string) => `${field} is required`,
    minLength: (field: string, length: number) => `${field} must be at least ${length} characters`,
    failedAction: (action?: string, target?: string) => `Failed to ${action} ${target}`,
  },
}
