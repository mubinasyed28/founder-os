import os
import pandas as pd
import numpy as np

# Load tables
rdir = 'ml/data/raw/ravenstack'
acc = pd.read_csv(f'{rdir}/ravenstack_accounts.csv')
sub = pd.read_csv(f'{rdir}/ravenstack_subscriptions.csv')
feat = pd.read_csv(f'{rdir}/ravenstack_feature_usage.csv')
supp = pd.read_csv(f'{rdir}/ravenstack_support_tickets.csv')
churn = pd.read_csv(f'{rdir}/ravenstack_churn_events.csv')

# Link feature usage to account_id
sub_acc_map = sub.set_index('subscription_id')['account_id'].to_dict()
feat['account_id'] = feat['subscription_id'].map(sub_acc_map)

# Parse dates
acc['signup_dt'] = pd.to_datetime(acc['signup_date'])
acc['signup_month'] = acc['signup_dt'].dt.to_period('M')

sub['start_dt'] = pd.to_datetime(sub['start_date'])
sub['end_dt'] = pd.to_datetime(sub['end_date']).fillna(pd.Timestamp('2024-12-31'))
sub['start_month'] = sub['start_dt'].dt.to_period('M')
sub['end_month'] = sub['end_dt'].dt.to_period('M')

feat['usage_dt'] = pd.to_datetime(feat['usage_date'])
feat['month'] = feat['usage_dt'].dt.to_period('M')

supp['sub_dt'] = pd.to_datetime(supp['submitted_at'])
supp['month'] = supp['sub_dt'].dt.to_period('M')

churn['churn_dt'] = pd.to_datetime(churn['churn_date'])
churn['month'] = churn['churn_dt'].dt.to_period('M')

# 1. Expand subscriptions to monthly active status
all_months = pd.period_range('2023-01', '2024-12', freq='M')

sub_records = []
for _, row in sub.iterrows():
    m_range = pd.period_range(max(row['start_month'], all_months[0]), 
                              min(row['end_month'], all_months[-1]), freq='M')
    for m in m_range:
        sub_records.append({
            'subscription_id': row['subscription_id'],
            'account_id': row['account_id'],
            'month': m,
            'plan_tier': row['plan_tier'],
            'seats': row['seats'],
            'mrr_amount': row['mrr_amount'],
            'arr_amount': row['arr_amount'],
            'billing_frequency': row['billing_frequency'],
            'upgrade_flag': row['upgrade_flag'],
            'downgrade_flag': row['downgrade_flag'],
            'sub_churn_flag': row['churn_flag']
        })

sub_monthly = pd.DataFrame(sub_records)

# Aggregate subscriptions per account-month
tier_order = {'Basic': 1, 'Pro': 2, 'Enterprise': 3}
sub_monthly['tier_rank'] = sub_monthly['plan_tier'].map(tier_order)

acc_sub_monthly = sub_monthly.groupby(['account_id', 'month']).agg(
    current_mrr=('mrr_amount', 'sum'),
    current_arr=('arr_amount', 'sum'),
    active_subscriptions=('subscription_id', 'count'),
    total_seats=('seats', 'sum'),
    max_tier_rank=('tier_rank', 'max'),
    has_upgrade_sub=('upgrade_flag', 'any'),
    has_downgrade_sub=('downgrade_flag', 'any'),
    has_churned_sub=('sub_churn_flag', 'any')
).reset_index()

rank_to_tier = {1: 'Basic', 2: 'Pro', 3: 'Enterprise'}
acc_sub_monthly['active_plan_tier'] = acc_sub_monthly['max_tier_rank'].map(rank_to_tier)

# 2. Aggregate monthly feature usage per account-month
feat_monthly = feat.groupby(['account_id', 'month']).agg(
    usage_count=('usage_count', 'sum'),
    usage_duration_secs=('usage_duration_secs', 'sum'),
    error_count=('error_count', 'sum'),
    n_unique_features=('feature_name', 'nunique'),
    has_beta_feature=('is_beta_feature', 'any')
).reset_index()

# 3. Aggregate monthly support tickets per account-month
supp_monthly = supp.groupby(['account_id', 'month']).agg(
    n_tickets=('ticket_id', 'count'),
    avg_resolution_hours=('resolution_time_hours', 'mean'),
    n_escalations=('escalation_flag', 'sum'),
    avg_csat=('satisfaction_score', 'mean'),
    avg_first_response_mins=('first_response_time_minutes', 'mean')
).reset_index()

# 4. Aggregate churn events per account-month
churn_monthly = churn.groupby(['account_id', 'month']).agg(
    n_churn_events=('churn_event_id', 'count'),
    has_reactivation=('is_reactivation', 'any'),
    churn_refund_amount=('refund_amount_usd', 'sum')
).reset_index()

# 5. Build full account panel: for every account, from signup_month to 2024-12
panel_rows = []
for _, a in acc.iterrows():
    aid = a['account_id']
    s_m = max(a['signup_month'], all_months[0])
    acc_months = pd.period_range(s_m, all_months[-1], freq='M')
    for idx, m in enumerate(acc_months):
        panel_rows.append({
            'account_id': aid,
            'month': m,
            'account_name': a['account_name'],
            'industry': a['industry'],
            'country': a['country'],
            'referral_source': a['referral_source'],
            'account_plan_tier': a['plan_tier'],
            'account_seats': a['seats'],
            'account_is_trial': a['is_trial'],
            'account_churn_flag': a['churn_flag'],
            'tenure_months': idx,
            'calendar_month': m.month,
            'calendar_year': m.year
        })

panel = pd.DataFrame(panel_rows)

# Merge all aggregations
panel = panel.merge(acc_sub_monthly, on=['account_id', 'month'], how='left')
panel = panel.merge(feat_monthly, on=['account_id', 'month'], how='left')
panel = panel.merge(supp_monthly, on=['account_id', 'month'], how='left')
panel = panel.merge(churn_monthly, on=['account_id', 'month'], how='left')

# Fill missing values for monthly activity
panel['current_mrr'] = panel['current_mrr'].fillna(0.0)
panel['current_arr'] = panel['current_arr'].fillna(0.0)
panel['active_subscriptions'] = panel['active_subscriptions'].fillna(0).astype(int)
panel['total_seats'] = panel['total_seats'].fillna(panel['account_seats'])
panel['active_plan_tier'] = panel['active_plan_tier'].fillna('None')
panel['has_upgrade_sub'] = panel['has_upgrade_sub'].fillna(False)
panel['has_downgrade_sub'] = panel['has_downgrade_sub'].fillna(False)
panel['has_churned_sub'] = panel['has_churned_sub'].fillna(False)

panel['usage_count'] = panel['usage_count'].fillna(0).astype(int)
panel['usage_duration_secs'] = panel['usage_duration_secs'].fillna(0).astype(int)
panel['error_count'] = panel['error_count'].fillna(0).astype(int)
panel['n_unique_features'] = panel['n_unique_features'].fillna(0).astype(int)
panel['has_beta_feature'] = panel['has_beta_feature'].fillna(False)

panel['n_tickets'] = panel['n_tickets'].fillna(0).astype(int)
panel['avg_resolution_hours'] = panel['avg_resolution_hours'].fillna(0.0)
panel['n_escalations'] = panel['n_escalations'].fillna(0).astype(int)
panel['avg_first_response_mins'] = panel['avg_first_response_mins'].fillna(0.0)

panel['n_churn_events'] = panel['n_churn_events'].fillna(0).astype(int)
panel['has_reactivation'] = panel['has_reactivation'].fillna(False)
panel['churn_refund_amount'] = panel['churn_refund_amount'].fillna(0.0)

# Sort panel
panel = panel.sort_values(['account_id', 'month']).reset_index(drop=True)

# 6. Construct TARGETS by shifting within account
panel['next_month_mrr'] = panel.groupby('account_id')['current_mrr'].shift(-1)
panel['next_month_active'] = panel.groupby('account_id')['active_subscriptions'].shift(-1).apply(lambda x: 1 if x > 0 else (0 if pd.notna(x) else np.nan))

# Churn targets:
# Definition 1: Account-level churn at t+1: had active MRR at t, but next_month_mrr == 0
panel['target_account_churn_t1'] = np.where(
    panel['next_month_mrr'].isna(), np.nan,
    np.where((panel['current_mrr'] > 0) & (panel['next_month_mrr'] == 0), 1, 0)
)

# Definition 2: Churn event occurred in month t+1
panel['next_month_churn_events'] = panel.groupby('account_id')['n_churn_events'].shift(-1)
panel['target_churn_event_t1'] = np.where(
    panel['next_month_churn_events'].isna(), np.nan,
    np.where(panel['next_month_churn_events'] > 0, 1, 0)
)

# Definition 3: MRR Growth Rate
panel['target_mrr_growth_rate'] = np.where(
    panel['next_month_mrr'].isna() | (panel['current_mrr'] == 0), np.nan,
    (panel['next_month_mrr'] - panel['current_mrr']) / panel['current_mrr']
)

# Definition 4: Retention (stays active with MRR > 0)
panel['target_retention_t1'] = np.where(
    panel['next_month_mrr'].isna(), np.nan,
    np.where(panel['next_month_mrr'] > 0, 1, 0)
)

# Filter to valid supervised samples (non-null next_month_mrr)
supervised = panel.dropna(subset=['next_month_mrr']).copy()

# Save summary metrics to text for audit report
print('=== RAVENSTACK PANEL AUDIT SUMMARY ===')
print(f'Total account-month rows in panel: {len(panel)}')
print(f"Unique accounts: {panel['account_id'].nunique()}")
print(f"Date range of panel: {panel['month'].min()} to {panel['month'].max()} ({panel['month'].nunique()} months)")
print(f"Total supervised transitions (X_t -> Y_t+1): {len(supervised)}")
print(f"Supervised accounts: {supervised['account_id'].nunique()}")
print(f"Supervised observations with current_mrr > 0: {(supervised['current_mrr'] > 0).sum()}")

print('\n--- TARGET A: Next-Month MRR (Regression) ---')
s_mrr = supervised[supervised['current_mrr'] > 0]['next_month_mrr']
print(f'Valid active observations: {len(s_mrr)}')
print(f'Mean: ${s_mrr.mean():.2f}, Std: ${s_mrr.std():.2f}, Min: ${s_mrr.min():.2f}, Median: ${s_mrr.median():.2f}, Max: ${s_mrr.max():.2f}')
corr_current_next = supervised[supervised['current_mrr'] > 0][['current_mrr', 'next_month_mrr']].corr().iloc[0, 1]
print(f'Correlation between current_mrr and next_month_mrr: {corr_current_next:.4f}')

print('\n--- TARGET B: Next-Month MRR Growth Rate (Regression) ---')
growth = supervised['target_mrr_growth_rate'].dropna()
print(f'Valid growth observations: {len(growth)}')
print(f'Mean: {growth.mean():.4f}, Std: {growth.std():.4f}, Min: {growth.min():.4f}, Median: {growth.median():.4f}, Max: {growth.max():.4f}')
print(f'Percent positive growth: {(growth > 0).mean()*100:.1f}%')
print(f'Percent zero growth (flat): {(growth == 0).mean()*100:.1f}%')
print(f'Percent contraction (<0): {(growth < 0).mean()*100:.1f}%')

print('\n--- TARGET C: Churn Event in Month t+1 (Classification) ---')
churn_ev = supervised['target_churn_event_t1'].dropna()
print(f'Valid observations: {len(churn_ev)}')
print(f'Class balance (event=1 vs event=0): {churn_ev.value_counts().to_dict()}')
print(f'Event rate: {churn_ev.mean()*100:.2f}%')

print('\n--- TARGET D: Complete Account Churn (MRR drops to 0 at t+1) ---')
acc_churn = supervised[supervised['current_mrr'] > 0]['target_account_churn_t1'].dropna()
print(f'Valid active observations: {len(acc_churn)}')
print(f'Class balance (churn=1 vs 0): {acc_churn.value_counts().to_dict()}')
print(f'Churn rate: {acc_churn.mean()*100:.2f}%')

print('\n--- TARGET E: Customer Retention at t+1 (Binary) ---')
ret = supervised[supervised['current_mrr'] > 0]['target_retention_t1'].dropna()
print(f'Valid active observations: {len(ret)}')
print(f'Class balance (retained=1 vs 0): {ret.value_counts().to_dict()}')
print(f'Retention rate: {ret.mean()*100:.2f}%')

# Save panel to ml/data/processed/ravenstack_monthly_panel.csv for documented reproducibility
panel.to_csv('ml/data/processed/ravenstack_monthly_panel.csv', index=False)
print('\nSaved panel to ml/data/processed/ravenstack_monthly_panel.csv')
