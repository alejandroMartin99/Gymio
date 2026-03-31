import os
from functools import lru_cache

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()


@lru_cache
def get_supabase_service_client() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    service_role = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or not service_role:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    return create_client(url, service_role)


@lru_cache
def get_supabase_anon_client() -> Client:
    url = os.getenv("SUPABASE_URL", "")
    anon = os.getenv("SUPABASE_ANON_KEY", "")
    if not url or not anon:
        raise RuntimeError("Missing SUPABASE_URL or SUPABASE_ANON_KEY")
    return create_client(url, anon)
