from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import ModuleType


ROOT = Path(__file__).resolve().parent
sys.dont_write_bytecode = True
SOURCE_PATH = ROOT / "enemy-animation-suite-v3.source.json"
BASE_BUILDER_PATH = (
    ROOT.parent
    / "enemy-animation-suite-v2"
    / "build_enemy_animation_suite_v2.py"
)


def load_base_builder() -> ModuleType:
    spec = importlib.util.spec_from_file_location(
        "enemy_animation_suite_shared_builder",
        BASE_BUILDER_PATH,
    )
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Could not load shared builder: {BASE_BUILDER_PATH}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ROOT = ROOT
    module.SOURCE_PATH = SOURCE_PATH
    module.BUILDER_PATH = Path(__file__).resolve()
    return module


if __name__ == "__main__":
    load_base_builder().main()
