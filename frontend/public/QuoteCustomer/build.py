from pathlib import Path
import subprocess
subprocess.run(['node',str(Path(__file__).with_name('build-typescript.mjs'))],check=True)
