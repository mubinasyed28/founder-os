import pandas as pd
import numpy as np

path = 'ml/data/raw/startup_success_prediction/startup data.csv'
df = pd.read_csv(path)

print('=== STARTUP SUCCESS PREDICTION (923 ROWS) AUDIT ===')
print('Shape:', df.shape)
print('Target (status):', df['status'].value_counts().to_dict())
print('Target (labels):', df['labels'].value_counts().to_dict())

print('\nCorrelations with labels (1=acquired, 0=closed):')
num_cols = df.select_dtypes(include=[np.number]).columns.tolist()
corrs = df[num_cols].corr()['labels'].sort_values()
for col, val in corrs.items():
    print(f'  {col:30s}: {val:+.4f}')

print('\nFunding round flags by status:')
for r in ['has_roundA', 'has_roundB', 'has_roundC', 'has_roundD', 'has_VC', 'has_angel']:
    acq_m = df[df['labels'] == 1][r].mean()
    clo_m = df[df['labels'] == 0][r].mean()
    print(f'  {r}: acquired={acq_m:.2f}, closed={clo_m:.2f}')

print('\nMilestones and relationships by status:')
for m in ['relationships', 'funding_rounds', 'funding_total_usd', 'milestones', 'avg_participants']:
    acq_med = df[df['labels'] == 1][m].median()
    clo_med = df[df['labels'] == 0][m].median()
    print(f'  {m}: acquired={acq_med:.1f}, closed={clo_med:.1f}')
