#!/usr/bin/env python3
"""Generate deterministic expected V5 test vectors. Standard library only.
This validates the handoff policy; it does not execute the Sayari app.
"""
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = datetime(2026, 1, 1, 10, 0, tzinfo=timezone.utc)
iso = lambda dt: dt.isoformat().replace('+00:00', 'Z')

threshold = []
for n in [0, 1, 10, 49, 50, 51, 99, 100, 500, 999, 1000, 1001, 2000, 99999]:
    create = None if n < 50 else min(100, (n + 9) // 10)
    edit = min(100, max(5, (n + 9) // 10))
    threshold.append({'interestCount': n, 'CREATE': create, 'EDIT': edit, 'HIDE': edit,
        'CREATE_autoPublish': n < 50})

expiry = []
for kind, votes_after_hr in [
    ('CREATE', None), ('CREATE', 1), ('CREATE', 20), ('CREATE', 50), ('CREATE', 70), ('CREATE', 90),
    ('EDIT', None), ('EDIT', 4), ('EDIT', 23),
    ('HIDE', None), ('HIDE', 23),
]:
    last = BASE + timedelta(hours=votes_after_hr or 0)
    idle = last + timedelta(hours=24)
    target = max(BASE + timedelta(hours=72), idle) if kind == 'CREATE' else idle
    expiry.append({'kind':kind, 'submittedAt': iso(BASE), 'lastVoteChangedAt':iso(last),
        'hoursAfterSubmitOfLastVote': votes_after_hr, 'expectedExpiresAt':iso(target)})

voting = [
    {'start':[0,0],'old':None,'next':'yes','result':[1,0],'changed':True},
    {'start':[1,0],'old':'yes','next':'yes','result':[1,0],'changed':False},
    {'start':[1,0],'old':'yes','next':'no','result':[0,1],'changed':True},
    {'start':[0,1],'old':'no','next':'yes','result':[1,0],'changed':True},
    {'start':[1,1],'old':'no','next':'no','result':[1,1],'changed':False},
]

outcomes = [
    {'requiredVotes':5,'yesCount':4,'noCount':4,'expected':'pending'},
    {'requiredVotes':5,'yesCount':5,'noCount':0,'expected':'approved'},
    {'requiredVotes':5,'yesCount':0,'noCount':5,'expected':'rejected'},
    {'requiredVotes':5,'yesCount':5,'noCount':5,'expected':'approved'},
    {'requiredVotes':100,'yesCount':99,'noCount':99,'expected':'pending'},
    {'requiredVotes':100,'yesCount':100,'noCount':99,'expected':'approved'},
    {'requiredVotes':100,'yesCount':99,'noCount':100,'expected':'rejected'},
]

json_obj = {
 'version':'5.0.0', 'kind':'normative-domain-test-vectors',
 'notes': ['These are made-up timestamps and accounts for testing only.',
    'Null requiredVotes for CREATE below50 means auto publish, not threshold=0 vote request.',
    'No real ZZZ/Genshin story content in this file.'],
 'thresholdVectors': threshold,
 'deadlineVectors': expiry,
 'voteDeltaVectors': voting,
 'outcomeVectors': outcomes,
 'semanticCases': [
   {'id':'follow-on-view','expect':'no interest count change without explicit follow'},
   {'id':'guest','expect':'public stories only, no requests/actions, not counted interested'},
   {'id':'logged-not-followed','expect':'topic heading & follow CTA only in UI'},
   {'id':'self-vote','expect':'reject if request.submittedBy == voter.uid'},
   {'id':'edit-lock','expect':'one active EDIT proposal per story under concurrent submit'},
   {'id':'pending-edit-reset','expect':'new interested snapshot, zero effective votes, new clock'},
   {'id':'hide-round-retry','expect':'new interest snapshot from fresh HIDE request'},
   {'id':'hide-approved','expect':'hide public projection, keep internal archive'},
   {'id':'request-icons','expect':'toggle default OFF, ON ghost/edit warning top-right/hide X top-right'},
   {'id':'move-relative-anchor','expect':'recompute dependents or mark unresolved without fabrication'},
   {'id':'no-download','expect':'open documents inline; unsupported format message not forced download'},
 ]
}
path=ROOT/'tests'/'vectors.v5.json'
path.write_text(json.dumps(json_obj,ensure_ascii=False,indent=2)+'\n', encoding='utf-8')
print(f'Generated {path}, {len(threshold)} threshold and {len(expiry)} deadline vectors')
