import structlog
from tree_sitter import Language, Parser

logger = structlog.get_logger()

languages_to_load = [
    ("python", "tree_sitter_python"),
    ("javascript", "tree_sitter_javascript"),
    ("java", "tree_sitter_java"),
    ("go", "tree_sitter_go"),
    ("rust", "tree_sitter_rust"),
    ("cpp", "tree_sitter_cpp"),
]

for lang_name, module_name in languages_to_load:
    print(f"--- Testing {lang_name} ({module_name}) ---")
    try:
        module = __import__(module_name)
        lang_func = getattr(module, "language", None)
        if lang_func:
            language = Language(lang_func())
            print(f"SUCCESS: Loaded {lang_name}")
        else:
            print(f"FAILURE: {module_name} has no 'language' attribute. Attributes: {dir(module)}")
    except ImportError as e:
        print(f"FAILURE: Could not import {module_name}: {e}")
    except Exception as e:
        print(f"FAILURE: Error loading {lang_name}: {e}")
