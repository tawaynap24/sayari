#!/usr/bin/env python3
"""Verify handoff kit file coverage and rule math (NOT Sayari app implementation)."""
from pathlib import Path
import json
import math
import datetime
import hashlib
import sys

ROOT=Path(__file__).resolve().parents[1]
REQUIRED=[
 '00_CODEX_PASTE_FIRST.txt','README_TH.md','CODEX_MASTER_PROMPT_TH.md',
 'docs/00_REQUIREMENTS_PRIORITY.md','docs/01_FUNCTIONAL_SPEC.md',
 'docs/02_VOTING_RULES.md','docs/03_TIME_ENGINE.md',
 'docs/04_BACKEND_AND_SECURITY.md','docs/05_UI_UX.md',
 'docs/06_TEST_PLAN.md','docs/07_MEDIA_AND_REFERENCES.md',
 'docs/08_ROLES_FOLLOWS_AND_PRIVACY.md','docs/09_TIMELINE_CONTENT_LIFECYCLE.md',
 'docs/10_IMPLEMENTATION_ORDER.md','docs/11_OPEN_DECISIONS.md',
 'docs/12_PERFORMANCE_AND_DEPLOY.md','docs/13_THAI_LANGUAGE.md',
 'docs/14_ARCHITECTURE_DIAGRAM.md',
 'reference/policy.v5.json','reference/FIREBASE_OFFICIAL_DOCS.md',
 'reference/PROJECT_FACTS_AND_PRESERVATION.md',
 'reference/SAYARI_PROJECT_SUMMARY.txt',
 'contracts/vote-policy.ts','contracts/timeline-types.ts',
 'tests/ACCEPTANCE_CHECKLIST.md','tests/USER_SCENARIOS_TH.md',
 'tests/vectors.v5.json','templates/CODEX_FINAL_REPORT.md',
 'tools/generate_vectors.py','tools/verify_kit.py',
]
missing=[x for x in REQUIRED if not (ROOT/x).is_file()]
if missing: raise SystemExit(f'Missing required: {missing}')

policy=json.loads((ROOT/'reference/policy.v5.json').read_text('utf-8'))
data=json.loads((ROOT/'tests/vectors.v5.json').read_text('utf-8'))
assert policy['vote']['maxRequiredVotes']==100
assert policy['timeouts']['createMinBeforeTimeoutHours']==72
assert policy['timeouts']['allTypesNoProgressHours']==24
assert policy['media']['maxBytesPerFile']==5000000
for v in data['thresholdVectors']:
 n=v['interestCount']
 expected_create=None if n<50 else min(100,math.ceil(n/10))
 expected_other=min(100,max(5,math.ceil(n/10)))
 assert v['CREATE']==expected_create and v['EDIT']==expected_other and v['HIDE']==expected_other,v
 assert v['CREATE_autoPublish']==(n<50),v
for v in data['deadlineVectors']:
 iso=lambda val:datetime.datetime.fromisoformat(val.replace('Z','+00:00'))
 submitted=iso(v['submittedAt']); last=iso(v['lastVoteChangedAt'])
 expected=last+datetime.timedelta(hours=24)
 if v['kind']=='CREATE': expected=max(expected,submitted+datetime.timedelta(hours=72))
 assert expected==iso(v['expectedExpiresAt']),v
for v in data['voteDeltaVectors']:
 yes,no=v['start']; old=v['old']; new=v['next']
 result=[yes-(old=='yes')+(new=='yes') if old!=new else yes,
         no-(old=='no')+(new=='no') if old!=new else no]
 assert result==v['result'] and (old!=new)==v['changed'],v
for v in data['outcomeVectors']:
 result='approved' if v['yesCount']>=v['requiredVotes'] else 'rejected' if v['noCount']>=v['requiredVotes'] else 'pending'
 assert result==v['expected'],v
for p in ROOT.rglob('*'):
 if p.is_file() and p.suffix in {'.md','.txt','.ts','.json','.py'}:
  text=p.read_text('utf-8')
  assert '\x00' not in text, p
  assert '\ufffd' not in text, p
  assert not p.is_symlink(),p
print('PASS handoff kit: files=',len([p for p in ROOT.rglob('*') if p.is_file()]),
      ' thresholds=',len(data['thresholdVectors']),
      ' deadline=',len(data['deadlineVectors']),
      ' voteDelta=',len(data['voteDeltaVectors']),
      ' outcome=',len(data['outcomeVectors']))
print('NOTE: PASS verifies only kit/spec/vector consistency, NOT app implementation.')
