"""Validation shared by the public importer and offline regression tests."""
import re

def validate_rows(batch, year, kind):
    rows = {}
    for original in batch:
        row = {k: re.sub(r'\s+', ' ', v).strip() if isinstance(v, str) else v for k,v in original.items()}
        actual = row.get('ProgramAcademicYear') if kind.startswith('program') else row.get('Year')
        if actual is None or int(actual) != year:
            raise ValueError('Returned catalogue year does not match SelectedYear')
        code = row.get('AcademicPlanCode') or row.get('CourseCode') or row.get('SubPlanCode')
        if not code:
            raise ValueError('Missing catalogue identifier')
        if code in rows and rows[code] != row:
            raise ValueError('Conflicting duplicate identifier: '+code)
        rows[code] = row
    if not rows:
        raise ValueError('Empty catalogue response; refusing to promote import')
    return list(rows.values())
