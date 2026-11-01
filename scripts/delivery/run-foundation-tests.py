"""Actual unittest case outcomes, without names, messages, stdout or fixture data."""
import hashlib, json, time, unittest
from pathlib import Path
class Result(unittest.TextTestResult):
    records=[]
    def startTest(self,test):
        super().startTest(test); self.started=time.monotonic(); self.outcome='passed'
    def addFailure(self,test,err): self.outcome='failed'; super().addFailure(test,err)
    def addError(self,test,err): self.outcome='failed'; super().addError(test,err)
    def addSkip(self,test,reason): self.outcome='skipped'; super().addSkip(test,reason)
    def addExpectedFailure(self,test,err): self.outcome='skipped'; super().addExpectedFailure(test,err)
    def addUnexpectedSuccess(self,test): self.outcome='failed'; super().addUnexpectedSuccess(test)
    def addSubTest(self,test,subtest,err):
        if err: self.outcome='failed'
        super().addSubTest(test,subtest,err)
    def stopTest(self,test):
        self.records.append(dict(schema=1,kind='test',id=hashlib.sha256(test.id().encode()).hexdigest(),ordinal=len(self.records),status=self.outcome,durationMs=(time.monotonic()-self.started)*1000)); super().stopTest(test)
suite=unittest.defaultTestLoader.discover('tests')
result=unittest.TextTestRunner(verbosity=2,resultclass=Result).run(suite)
Path('.delivery-reports').mkdir(exist_ok=True)
Path('.delivery-reports/foundation.jsonl').write_text(''.join(json.dumps(x)+'\n' for x in result.records))
raise SystemExit(0 if result.wasSuccessful() else 1)
