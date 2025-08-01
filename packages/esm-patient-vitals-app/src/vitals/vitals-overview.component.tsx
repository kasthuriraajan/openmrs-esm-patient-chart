import React, { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReactToPrint } from 'react-to-print';
import { Button, ContentSwitcher, DataTableSkeleton, IconSwitch, InlineLoading } from '@carbon/react';
import { Analytics, Table } from '@carbon/react/icons';
import { CardHeader, EmptyState, ErrorState } from '@openmrs/esm-patient-common-lib';
import {
  AddIcon,
  PrinterIcon,
  age,
  getPatientName,
  formatDate,
  parseDate,
  useConfig,
  useLayoutType,
} from '@openmrs/esm-framework';
import type { ConfigObject } from '../config-schema';
import type { VitalsTableHeader, VitalsTableRow } from './types';
import { useLaunchVitalsAndBiometricsForm } from '../utils';
import { useVitalsAndBiometrics, useConceptUnits, withUnit } from '../common';
import PaginatedVitals from './paginated-vitals.component';
import PrintComponent from './print/print.component';
import VitalsChart from './vitals-chart.component';
import styles from './vitals-overview.scss';

interface VitalsOverviewProps {
  patientUuid: string;
  patient: fhir.Patient;
  pageSize: number;
  urlLabel: string;
  pageUrl: string;
}

const VitalsOverview: React.FC<VitalsOverviewProps> = ({ patientUuid, patient, pageSize, urlLabel, pageUrl }) => {
  const { t } = useTranslation();
  const config = useConfig<ConfigObject>();
  const displayText = t('vitalSigns', 'vital signs');
  const headerTitle = t('vitals', 'Vitals');
  const [chartView, setChartView] = useState(false);
  const isTablet = useLayoutType() === 'tablet';
  const [isPrinting, setIsPrinting] = useState(false);
  const contentToPrintRef = useRef(null);
  const launchVitalsBiometricsForm = useLaunchVitalsAndBiometricsForm();

  const { excludePatientIdentifierCodeTypes } = useConfig();
  const { data: vitals, error, isLoading, isValidating } = useVitalsAndBiometrics(patientUuid);
  const { conceptUnits } = useConceptUnits();
  const showPrintButton = config.vitals.showPrintButton && !chartView;

  const patientDetails = useMemo(() => {
    const getGender = (gender: string): string => {
      switch (gender) {
        case 'male':
          return t('male', 'Male');
        case 'female':
          return t('female', 'Female');
        case 'other':
          return t('other', 'Other');
        case 'unknown':
          return t('unknown', 'Unknown');
        default:
          return gender;
      }
    };

    const identifiers =
      patient?.identifier?.filter(
        (identifier) => !excludePatientIdentifierCodeTypes?.uuids.includes(identifier.type.coding[0].code),
      ) ?? [];

    return {
      name: patient ? getPatientName(patient) : '',
      age: age(patient?.birthDate),
      gender: getGender(patient?.gender),
      location: patient?.address?.[0].city,
      identifiers: identifiers?.length ? identifiers.map(({ value }) => value) : [],
    };
  }, [patient, t, excludePatientIdentifierCodeTypes?.uuids]);

  const tableHeaders: Array<VitalsTableHeader> = [
    {
      key: 'dateRender',
      header: t('dateAndTime', 'Date and time'),
      isSortable: true,
      sortFunc: (valueA, valueB) => new Date(valueA.date).getTime() - new Date(valueB.date).getTime(),
    },
    {
      key: 'temperatureRender',
      header: withUnit(t('temperatureAbbreviated', 'Temp'), conceptUnits.get(config.concepts.temperatureUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) =>
        valueA.temperature && valueB.temperature ? valueA.temperature - valueB.temperature : 0,
    },
    {
      key: 'bloodPressureRender',
      header: withUnit(
        t('bloodPressureAbbreviated', 'BP'),
        conceptUnits.get(config.concepts.systolicBloodPressureUuid) ?? '',
      ),
      isSortable: true,
      sortFunc: (valueA, valueB) =>
        valueA.systolic && valueB.systolic && valueA.diastolic && valueB.diastolic
          ? valueA.systolic !== valueB.systolic
            ? valueA.systolic - valueB.systolic
            : valueA.diastolic - valueB.diastolic
          : 0,
    },
    {
      key: 'pulseRender',
      header: withUnit(t('pulse', 'Pulse'), conceptUnits.get(config.concepts.pulseUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) => (valueA.pulse && valueB.pulse ? valueA.pulse - valueB.pulse : 0),
    },
    {
      key: 'respiratoryRateRender',
      header: withUnit(
        t('respiratoryRateAbbreviated', 'R. Rate'),
        conceptUnits.get(config.concepts.respiratoryRateUuid) ?? '',
      ),
      isSortable: true,
      sortFunc: (valueA, valueB) =>
        valueA.respiratoryRate && valueB.respiratoryRate ? valueA.respiratoryRate - valueB.respiratoryRate : 0,
    },
    {
      key: 'spo2Render',
      header: withUnit(t('spo2', 'SpO2'), conceptUnits.get(config.concepts.oxygenSaturationUuid) ?? ''),
      isSortable: true,
      sortFunc: (valueA, valueB) => (valueA.spo2 && valueB.spo2 ? valueA.spo2 - valueB.spo2 : 0),
    },
  ];

  const tableRows: Array<VitalsTableRow> = useMemo(
    () =>
      vitals?.map((vitalSigns) => {
        return {
          ...vitalSigns,
          dateRender: formatDate(parseDate(vitalSigns.date.toString()), { mode: 'wide', time: true }),
          bloodPressureRender: `${vitalSigns.systolic ?? '--'} / ${vitalSigns.diastolic ?? '--'}`,
          bloodPressureRenderInterpretation: vitalSigns.bloodPressureRenderInterpretation,
          pulseRender: vitalSigns.pulse ?? '--',
          pulseRenderInterpretation: vitalSigns.pulseRenderInterpretation,
          spo2Render: vitalSigns.spo2 ?? '--',
          spo2RenderInterpretation: vitalSigns.spo2RenderInterpretation,
          temperatureRender: vitalSigns.temperature ?? '--',
          temperatureRenderInterpretation: vitalSigns.temperatureRenderInterpretation,
          respiratoryRateRender: vitalSigns.respiratoryRate ?? '--',
          respiratoryRateRenderInterpretation: vitalSigns.respiratoryRateRenderInterpretation,
        };
      }),
    [vitals],
  );

  const onBeforeGetContentResolve = useRef(null);

  useEffect(() => {
    if (isPrinting && onBeforeGetContentResolve.current) {
      onBeforeGetContentResolve.current();
    }
  }, [isPrinting]);

  const handlePrint = useReactToPrint({
    content: () => contentToPrintRef.current,
    documentTitle: `OpenMRS - ${patientDetails.name} - ${headerTitle}`,
    onBeforeGetContent: () =>
      new Promise((resolve) => {
        if (patient && headerTitle) {
          onBeforeGetContentResolve.current = resolve;
          setIsPrinting(true);
        }
      }),
    onAfterPrint: () => {
      onBeforeGetContentResolve.current = null;
      setIsPrinting(false);
    },
  });

  const getSortedBP = () => {
    let sortedVitals = vitals.sort(
      (vitalA, vitalB) => new Date(vitalB.date).getTime() - new Date(vitalA.date).getTime(),
    );
    sortedVitals = sortedVitals.filter((vital) => vital.systolic > 0 && vital.diastolic > 0);
    return sortedVitals;
  };

  const handleOpenClinical = () => {
    const bp = getSortedBP();
    const openClinicalURL =
      'http://localhost:22221/digipath/matt/ht_demo?dob=' +
      patient.birthDate +
      '&gender=' +
      patient.gender +
      '&sbp=' +
      bp[0].systolic +
      '&dbp=' +
      bp[0].diastolic +
      '&id=' +
      patient.id;
    window.location.href = openClinicalURL;
  };

  return (
    <>
      {(() => {
        if (isLoading) {
          return <DataTableSkeleton role="progressbar" compact={!isTablet} zebra />;
        }

        if (error) {
          return <ErrorState error={error} headerTitle={headerTitle} />;
        }

        if (vitals?.length) {
          return (
            <div className={styles.widgetCard}>
              <CardHeader title={headerTitle}>
                <div className={styles.backgroundDataFetchingIndicator}>
                  <span>{isValidating ? <InlineLoading /> : null}</span>
                </div>
                <div className={styles.vitalsHeaderActionItems}>
                  <ContentSwitcher
                    onChange={(evt: ChangeEvent<HTMLButtonElement> & { name: string }) =>
                      setChartView(evt.name === 'chartView')
                    }
                    size={isTablet ? 'md' : 'sm'}
                    selectedIndex={chartView ? 1 : 0}
                  >
                    <IconSwitch name="tableView" text="Table view">
                      <Table size={16} />
                    </IconSwitch>
                    <IconSwitch name="chartView" text="Chart view">
                      <Analytics size={16} />
                    </IconSwitch>
                  </ContentSwitcher>
                  <>
                    <span className={styles.divider}>|</span>
                    {showPrintButton && (
                      <Button
                        kind="ghost"
                        renderIcon={PrinterIcon}
                        iconDescription="Add vitals"
                        className={styles.printButton}
                        onClick={handlePrint}
                      >
                        {t('print', 'Print')}
                      </Button>
                    )}
                    <Button
                      kind="ghost"
                      renderIcon={AddIcon}
                      iconDescription="Add vitals"
                      onClick={launchVitalsBiometricsForm}
                    >
                      {t('add', 'Add')}
                    </Button>
                  </>
                </div>
              </CardHeader>
              {chartView ? (
                <VitalsChart patientVitals={vitals} conceptUnits={conceptUnits} config={config} />
              ) : (
                <div ref={contentToPrintRef}>
                  <PrintComponent subheader={headerTitle} patientDetails={patientDetails} />
                  <PaginatedVitals
                    isPrinting={isPrinting}
                    pageSize={pageSize}
                    pageUrl={pageUrl}
                    tableHeaders={tableHeaders}
                    tableRows={tableRows}
                    urlLabel={urlLabel}
                  />
                </div>
              )}
              {getSortedBP().length > 0 && (
                <Button onClick={handleOpenClinical}>Get Open Clinical Recommendation</Button>
              )}
            </div>
          );
        }
        return (
          <EmptyState displayText={displayText} headerTitle={headerTitle} launchForm={launchVitalsBiometricsForm} />
        );
      })()}
    </>
  );
};

export default VitalsOverview;
