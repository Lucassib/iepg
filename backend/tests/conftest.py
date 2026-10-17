import os

# The application tests send many requests from one client: the rate limits are tested on their own, in
# test_security.py, with a guard built for the purpose.
os.environ.setdefault("IEPG_RATE_LIMITS", "0")
