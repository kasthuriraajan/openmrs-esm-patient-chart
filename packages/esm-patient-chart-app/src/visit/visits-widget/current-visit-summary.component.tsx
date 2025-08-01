import React from 'react';
import { useTranslation } from 'react-i18next';
import { InlineLoading } from '@carbon/react';
import { ErrorState, launchWorkspace, useVisit } from '@openmrs/esm-framework';
import { CardHeader, EmptyState } from '@openmrs/esm-patient-common-lib';
import VisitSummary from './past-visits-components/visit-summary.component';
import styles from './current-visit-summary.scss';

interface CurrentVisitSummaryProps {
  patientUuid: string;
}

const CurrentVisitSummary: React.FC<CurrentVisitSummaryProps> = ({ patientUuid }) => {
  const { t } = useTranslation();
  const { isLoading, currentVisit, error, isValidating } = useVisit(patientUuid);

  if (isLoading) {
    return (
      <InlineLoading
        status="active"
        iconDescription={t('loading', 'Loading')}
        description={t('loadingVisit', 'Loading current visit...')}
      />
    );
  }

  if (!!error) {
    return <ErrorState headerTitle={t('failedToLoadCurrentVisit', 'Failed loading current visit')} error={error} />;
  }

  if (!currentVisit) {
    return (
      <EmptyState
        headerTitle={t('currentVisit', 'Current visit')}
        displayText={t('noActiveVisitMessage', 'active visit')}
        launchForm={() =>
          launchWorkspace('start-visit-workspace-form', { openedFrom: 'patient-chart-current-visit-summary' })
        }
      />
    );
  }

  return (
    <div className={styles.container}>
      <CardHeader title={t('currentVisit', 'Current visit')}>
        <span>{isValidating ? <InlineLoading /> : null}</span>
      </CardHeader>
      <div className={styles.visitSummaryCard}>
        <VisitSummary visit={currentVisit} patientUuid={patientUuid} />
      </div>
    </div>
  );
};

export default CurrentVisitSummary;
