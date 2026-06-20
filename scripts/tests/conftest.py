"""Put scripts/ on sys.path so tests import the cron modules directly.

The scripts run as top-level files (no package), so `from ingest_trades import
…` needs the parent dir on the path. Import is side-effect-free: every module
only defines constants/regexes/functions at import time and guards real work
behind `if __name__ == "__main__"`.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
