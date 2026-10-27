# [test] 배송 후속 head를 허용해도 미검토 head·분기·잘못된 부모는 계속 거부한다.
import asyncio
from pathlib import Path
import runpy
from types import SimpleNamespace

import pytest

adoption = runpy.run_path(str(Path(__file__).resolve().parents[2] / 'scripts/adopt_shared_baseline.py'))


@pytest.mark.parametrize('heads,parent', [
    (['unknown'], '3f21520f9615'),
    (['3f21520f9615', '4c726d1a91ab'], '3f21520f9615'),
    (['4c726d1a91ab'], 'wrong-parent'),
])
def test_baseline_rejects_unknown_multiple_or_misparented_heads(monkeypatch, heads, parent):
    scripts = SimpleNamespace(get_heads=lambda: heads,
                              get_revision=lambda revision: SimpleNamespace(down_revision=parent))
    monkeypatch.setattr(adoption['ScriptDirectory'], 'from_config', lambda config: scripts)
    with pytest.raises(ValueError, match='head'):
        asyncio.run(adoption['run']('postgresql+asyncpg://ci:ci@localhost/reference',
                                   'postgresql+asyncpg://ci:ci@localhost/target', 'target', 'ci'))
