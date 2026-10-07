# -*- coding: utf-8 -*-
"""One command: lint, then build every PDF and the web app. Usage: python build/all.py"""
import os, subprocess, sys
here = os.path.dirname(os.path.abspath(__file__))
for script in ("lint.py", "pdf.py", "app.py"):
    if subprocess.call([sys.executable, os.path.join(here, script)]) != 0:
        sys.exit("stopped: %s failed" % script)
print("\nPDFs are in dist/pdf/")
