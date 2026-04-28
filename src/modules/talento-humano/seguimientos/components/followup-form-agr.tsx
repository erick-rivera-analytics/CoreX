"use client";

import { FormSection } from "@/shared/forms/form-section";
import { TextInputField } from "@/shared/forms/text-input-field";
import { TextareaField } from "@/shared/forms/textarea-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { DateField } from "@/shared/filters/date-field";

export type AgrFormState = {
  agrFreq: string;
  workDiffEncoded: string;
  workDifficultyObs: string;
  coworkerRating: string;
  supervisorRating: string;
  areaManagerRating: string;
  conflictPersonId: string;
  conflictDetail: string;
  workLikeMostEncoded: string;
  workLikeMostObs: string;
  improvOppEncoded: string;
  improvementOppObs: string;
  agrSatisfactionObs: string;
  retentionIntention: string;
  retentionReasonObs: string;
  shortRetentionEncoded: string;
  hrSupportNeed: string;
  hrSupportOther: string;
  familyPregnancyRelation: string;
  familyPregnancyObs: string;
  hasInconvenience: string;
  inconvenienceDate: string;
  inconvenienceActivity: string;
  inconvenienceActivityOther: string;
  inconvenienceType: string;
  inconvenienceTypeOther: string;
};

type SetField = <K extends keyof AgrFormState>(key: K, value: AgrFormState[K]) => void;

type Opts = string[];
type DV = (v: string) => string;

type Props = {
  state: AgrFormState;
  setField: SetField;
  // Options + displayValue per catalog
  agrFreqOpts: Opts; agrFreqDV: DV;
  ratingOpts: Opts; ratingDV: DV;
  yesNoOpts: Opts; yesNoDV: DV;
  retentionOpts: Opts; retentionDV: DV;
  hrSupportOpts: Opts; hrSupportDV: DV;
  familyOpts: Opts; familyDV: DV;
  activityOpts: Opts; activityDV: DV;
  inconvTypeOpts: Opts; inconvTypeDV: DV;
  workDiffOpts: Opts; workDiffDV: DV;
  workLikeMostOpts: Opts; workLikeMostDV: DV;
  improvOpts: Opts; improvDV: DV;
  shortRetentionOpts: Opts; shortRetentionDV: DV;
};

export function FollowupFormAgr({ state, setField, ...opts }: Props) {
  const shortRetentionVisible = ["less_than_3_months", "between_3_and_6_months", "between_6_months_and_1_year"]
    .includes(state.retentionIntention);

  const s = state;
  const sf = <K extends keyof AgrFormState>(k: K) => (v: AgrFormState[K]) => setField(k, v);

  return (
    <>
      <FormSection title="Seguimiento Agrícola">
        <SingleSelectField id="agr-freq" label="Frecuencia de seguimiento *" value={s.agrFreq} options={opts.agrFreqOpts} displayValue={opts.agrFreqDV} onChange={sf("agrFreq")} />
        <MultiSelectField id="work-difficulty" label="Dificultades en el trabajo" value={s.workDiffEncoded} options={opts.workDiffOpts} displayValue={opts.workDiffDV} onChange={sf("workDiffEncoded")} />
        <TextareaField id="work-difficulty-obs" label="Observación dificultades" value={s.workDifficultyObs} onChange={sf("workDifficultyObs")} rows={2} />
      </FormSection>

      <FormSection title="Trato">
        <SingleSelectField id="coworker-rating" label="Trato de compañeros" value={s.coworkerRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("coworkerRating")} />
        <SingleSelectField id="supervisor-rating" label="Trato del supervisor" value={s.supervisorRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("supervisorRating")} />
        <SingleSelectField id="area-manager-rating" label="Trato del jefe de área" value={s.areaManagerRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("areaManagerRating")} />
        <TextInputField id="conflict-person" label="ID persona en conflicto" value={s.conflictPersonId} onChange={sf("conflictPersonId")} />
        <TextareaField id="conflict-detail" label="Detalle del conflicto" value={s.conflictDetail} onChange={sf("conflictDetail")} rows={2} />
      </FormSection>

      <FormSection title="Motivación">
        <MultiSelectField id="work-like-most" label="Lo que más le gusta del trabajo" value={s.workLikeMostEncoded} options={opts.workLikeMostOpts} displayValue={opts.workLikeMostDV} onChange={sf("workLikeMostEncoded")} />
        <TextareaField id="work-like-most-obs" label="Observación" value={s.workLikeMostObs} onChange={sf("workLikeMostObs")} rows={2} />
        <MultiSelectField id="improvement-opp" label="Oportunidad de mejora" value={s.improvOppEncoded} options={opts.improvOpts} displayValue={opts.improvDV} onChange={sf("improvOppEncoded")} />
        <TextareaField id="improvement-opp-obs" label="Observación" value={s.improvementOppObs} onChange={sf("improvementOppObs")} rows={2} />
        <TextareaField id="agr-satisfaction-obs" label="Satisfacción general" value={s.agrSatisfactionObs} onChange={sf("agrSatisfactionObs")} rows={2} />
      </FormSection>

      <FormSection title="Permanencia">
        <SingleSelectField id="retention-intention" label="¿Por cuánto tiempo más le gustaría seguir trabajando en la empresa?" value={s.retentionIntention} options={opts.retentionOpts} displayValue={opts.retentionDV} onChange={sf("retentionIntention")} />
        {shortRetentionVisible && (
          <MultiSelectField id="short-retention" label="Razones para salir pronto" value={s.shortRetentionEncoded} options={opts.shortRetentionOpts} displayValue={opts.shortRetentionDV} onChange={sf("shortRetentionEncoded")} />
        )}
        <TextareaField id="retention-reason-obs" label="Observación permanencia" value={s.retentionReasonObs} onChange={sf("retentionReasonObs")} rows={2} />
      </FormSection>

      <FormSection title="Apoyo RRHH">
        <SingleSelectField id="hr-support" label="Necesidad de apoyo" value={s.hrSupportNeed} options={opts.hrSupportOpts} displayValue={opts.hrSupportDV} onChange={sf("hrSupportNeed")} />
        {s.hrSupportNeed === "other" && (
          <TextInputField id="hr-support-other" label="Especificar apoyo *" value={s.hrSupportOther} onChange={sf("hrSupportOther")} />
        )}
      </FormSection>

      <FormSection title="Familiar / Embarazo">
        <SingleSelectField id="family-relation" label="Relación familiar/embarazo" value={s.familyPregnancyRelation} options={opts.familyOpts} displayValue={opts.familyDV} onChange={sf("familyPregnancyRelation")} />
        <TextareaField id="family-obs" label="Observación" value={s.familyPregnancyObs} onChange={sf("familyPregnancyObs")} rows={2} />
      </FormSection>

      <FormSection title="Novedad">
        <SingleSelectField id="has-inconvenience" label="¿Hubo novedad?" value={s.hasInconvenience} options={opts.yesNoOpts} displayValue={opts.yesNoDV} onChange={sf("hasInconvenience")} />
        {s.hasInconvenience === "yes" && (
          <>
            <DateField label="Fecha de novedad *" value={s.inconvenienceDate} onChange={sf("inconvenienceDate")} />
            <SingleSelectField id="inconvenience-activity" label="Actividad *" value={s.inconvenienceActivity} options={opts.activityOpts} displayValue={opts.activityDV} onChange={sf("inconvenienceActivity")} />
            {s.inconvenienceActivity === "other" && (
              <TextInputField id="inconvenience-activity-other" label="Especificar actividad *" value={s.inconvenienceActivityOther} onChange={sf("inconvenienceActivityOther")} />
            )}
            <SingleSelectField id="inconvenience-type" label="Tipo de novedad *" value={s.inconvenienceType} options={opts.inconvTypeOpts} displayValue={opts.inconvTypeDV} onChange={sf("inconvenienceType")} />
            {s.inconvenienceType === "other" && (
              <TextInputField id="inconvenience-type-other" label="Especificar tipo *" value={s.inconvenienceTypeOther} onChange={sf("inconvenienceTypeOther")} />
            )}
          </>
        )}
      </FormSection>
    </>
  );
}
