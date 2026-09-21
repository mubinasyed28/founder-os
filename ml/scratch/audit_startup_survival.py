import pandas as pd
import numpy as np

path = 'ml/data/raw/startup_survival/startup_survival_master.csv'
df = pd.read_csv(path)

print('=== STARTUP & FOUNDER SURVIVAL DEEP AUDIT ===')
print(f'Total rows: {len(df)}')
print(f'Total columns: {len(df.columns)}')
print(f'Duplicates: {df.duplicated().sum()}')

print('\n--- TARGETS & OUTCOMES ---')
print('failed:', df['failed'].value_counts(normalize=True).to_dict())
print('outcome:', df['outcome'].value_counts(normalize=True).to_dict())
print('survived_5y:', df['survived_5y'].value_counts(normalize=True).to_dict())
print('failure_reason:\n', df['failure_reason'].value_counts().to_dict())

print('\n--- CORRELATIONS WITH TARGET (failed) ---')
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
corrs = df[num_cols].corr()['failed'].sort_values()
for col, val in corrs.items():
    print(f'  {col:30s}: {val:+.4f}')

print('\n--- FUNDING PATH & TOTAL RAISED ---')
print(df.groupby('funding_path').agg(
    count=('startup_id', 'count'),
    mean_raised=('total_raised_usd', 'mean'),
    median_raised=('total_raised_usd', 'median'),
    max_raised=('total_raised_usd', 'max'),
    fail_rate=('failed', 'mean')
))

print('\n--- YEARS TO OUTCOME BY OUTCOME ---')
print(df.groupby('outcome')['years_to_outcome'].describe())
