def create_ontox_api_error(message, status=None, details=None):
    # Create a consistent error for API failures.
    error = Exception(message or "OntoX API error")
    error.status = status
    error.details = details
    return error

