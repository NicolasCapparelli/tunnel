"""Export the already-built Aurora snapshot, without modifying its checkout."""
import importlib.util
import sys
from pathlib import Path

source = Path(sys.argv[1]).resolve()
spec = importlib.util.spec_from_file_location('aurora_vendor', source / 'tools/vendor.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
root = Path(__file__).resolve().parents[1]
module.export_javascript(
    'typescript', module.TS_PACKAGES + (module.RN_PACKAGES[1],), root, 'vendor/aurora', False,
    lambda: {'exportMethod': 'existing-built-dist', 'note': 'No source rebuild; includes web and native adapters.'},
    'Tunnel consumes one shared core with both React adapters. Exported from existing dist artifacts.\n',
)
