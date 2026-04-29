"use client";

import { decodeMultiSelectValue } from "@/lib/multi-select";
import { FormSection } from "@/shared/forms/form-section";
import { TextInputField } from "@/shared/forms/text-input-field";
import { TextareaField } from "@/shared/forms/textarea-field";
import { DateField } from "@/shared/filters/date-field";
import { MultiSelectField } from "@/shared/filters/multi-select-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";
import { PersonSearchField } from "@/modules/talento-humano/seguimientos/components/person-search-field";

export type AgrFormState = {
  workDiffEncoded: string;
  workDiffOther: string;
  workDifficultyObs: string;
  coworkerRating: string;
  supervisorRating: string;
  areaManagerRating: string;
  conflictPersonId: string;
  conflictDetail: string;
  workLikeMostEncoded: string;
  workLikeMostOther: string;
  workLikeMostObs: string;
  improvOppEncoded: string;
  improvOppOther: string;
  improvementOppObs: string;
  agrSatisfactionObs: string;
  retentionIntention: string;
  retentionReasonObs: string;
  shortRetentionEncoded: string;
  shortRetentionOther: string;
  hrSupportNeed: string;
  hrSupportOther: string;
  familyPregnancyRelation: string;
  familyPregnancyObs: string;
  developedActivitiesDescription: string;
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
  asOfDate?: string;
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

export function FollowupFormAgr({ state, setField, asOfDate, ...opts }: Props) {
  const shortRetentionVisible = ["less_than_3_months", "between_3_and_6_months", "between_6_months_and_1_year"]
    .includes(state.retentionIntention);
  const hasWorkDiffOther = decodeMultiSelectValue(state.workDiffEncoded).includes("other");
  const hasWorkLikeMostOther = decodeMultiSelectValue(state.workLikeMostEncoded).includes("other");
  const hasImprovOther = decodeMultiSelectValue(state.improvOppEncoded).includes("other");
  const hasShortRetentionOther = decodeMultiSelectValue(state.shortRetentionEncoded).includes("other");

  const s = state;
  const sf = <K extends keyof AgrFormState>(k: K) => (v: AgrFormState[K]) => setField(k, v);

  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <FormSection title="Dificultades en las actividades laborales">
        <MultiSelectField id="work-difficulty" label="¿Ha tenido dificultades que afecten el desempeño en el trabajo? *" value={s.workDiffEncoded} options={opts.workDiffOpts} displayValue={opts.workDiffDV} onChange={sf("workDiffEncoded")} />
        {hasWorkDiffOther ? <TextInputField id="work-difficulty-other" label="Otros *" value={s.workDiffOther} onChange={sf("workDiffOther")} /> : null}
        <TextareaField id="work-difficulty-obs" label="Observaciones" value={s.workDifficultyObs} onChange={sf("workDifficultyObs")} rows={2} />
      </FormSection>

      <FormSection title="Relaciones laborales">
        <SingleSelectField id="coworker-rating" label="Trato en el area de trabajo - Compañeros" value={s.coworkerRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("coworkerRating")} />
        <SingleSelectField id="supervisor-rating" label="Trato en el area de trabajo - Supervisor" value={s.supervisorRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("supervisorRating")} />
        <SingleSelectField id="area-manager-rating" label="Trato en el area de trabajo - Jefe de area" value={s.areaManagerRating} options={opts.ratingOpts} displayValue={opts.ratingDV} onChange={sf("areaManagerRating")} />
        <PersonSearchField id="conflict-person" label="Seleccione el nombre de la persona con quien tuvo algun inconveniente" value={s.conflictPersonId} onChange={sf("conflictPersonId")} asOfDate={asOfDate} />
        <TextareaField id="conflict-detail" label="Especifique la situacion, sobre tratos regulares o malos" value={s.conflictDetail} onChange={sf("conflictDetail")} rows={2} />
      </FormSection>

      <FormSection title="Satisfaccion laboral y oportunidades de mejora">
        <SingleSelectField id="work-like-most" label="¿Que es lo que mas le gusta de trabajar en la empresa? *" value={s.workLikeMostEncoded} options={opts.workLikeMostOpts} displayValue={opts.workLikeMostDV} onChange={sf("workLikeMostEncoded")} />
        {hasWorkLikeMostOther ? <TextInputField id="work-like-most-other" label="Otros *" value={s.workLikeMostOther} onChange={sf("workLikeMostOther")} /> : null}
        <TextareaField id="work-like-most-obs" label="Observaciones" value={s.workLikeMostObs} onChange={sf("workLikeMostObs")} rows={2} />
        <MultiSelectField id="improvement-opp" label="Oportunidades de mejora *" value={s.improvOppEncoded} options={opts.improvOpts} displayValue={opts.improvDV} onChange={sf("improvOppEncoded")} />
        {hasImprovOther ? <TextInputField id="improvement-opp-other" label="Otros *" value={s.improvOppOther} onChange={sf("improvOppOther")} /> : null}
        <TextareaField id="improvement-opp-obs" label="Observaciones" value={s.improvementOppObs} onChange={sf("improvementOppObs")} rows={2} />
      </FormSection>

      <FormSection title="Permanencia laboral">
        <SingleSelectField id="retention-intention" label="¿Por cuanto tiempo mas le gustaria seguir trabajando en la empresa? *" value={s.retentionIntention} options={opts.retentionOpts} displayValue={opts.retentionDV} onChange={sf("retentionIntention")} />
        {shortRetentionVisible ? (
          <>
            <MultiSelectField id="short-retention" label="Si la respuesta es menos de 1 año, ¿cual es la razon principal? *" value={s.shortRetentionEncoded} options={opts.shortRetentionOpts} displayValue={opts.shortRetentionDV} onChange={sf("shortRetentionEncoded")} />
            {hasShortRetentionOther ? <TextInputField id="short-retention-other" label="Otros *" value={s.shortRetentionOther} onChange={sf("shortRetentionOther")} /> : null}
          </>
        ) : null}
        <TextareaField id="retention-reason-obs" label="Observaciones" value={s.retentionReasonObs} onChange={sf("retentionReasonObs")} rows={2} />
      </FormSection>

      <FormSection title="Talento Humano">
        <SingleSelectField id="hr-support" label="Necesita algun apoyo por parte del departamento de Talento Humano *" value={s.hrSupportNeed} options={opts.hrSupportOpts} displayValue={opts.hrSupportDV} onChange={sf("hrSupportNeed")} />
        {s.hrSupportNeed === "other" ? <TextInputField id="hr-support-other" label="Otros *" value={s.hrSupportOther} onChange={sf("hrSupportOther")} /> : null}
        <SingleSelectField id="family-relation" label="Algun familiar suyo esta embarazada *" value={s.familyPregnancyRelation} options={opts.familyOpts} displayValue={opts.familyDV} onChange={sf("familyPregnancyRelation")} />
        <TextareaField id="family-obs" label="Observaciones" value={s.familyPregnancyObs} onChange={sf("familyPregnancyObs")} rows={2} />
      </FormSection>

      <FormSection title="Actividades desarrolladas">
        <TextareaField id="developed-activities-description" label="Descripción (opcional)" value={s.developedActivitiesDescription} onChange={sf("developedActivitiesDescription")} rows={2} placeholder="Describa brevemente las actividades desarrolladas" />
        <SingleSelectField id="has-inconvenience" label="Inconvenientes *" value={s.hasInconvenience} options={opts.yesNoOpts} displayValue={opts.yesNoDV} onChange={sf("hasInconvenience")} />
        {s.hasInconvenience === "yes" ? (
          <>
            <DateField label="Ingrese la fecha del inconveniente *" helperText="Día, mes, año" value={s.inconvenienceDate} onChange={sf("inconvenienceDate")} />
            <SingleSelectField id="inconvenience-activity" label="En qué actividad tuvo inconvenientes *" value={s.inconvenienceActivity} options={opts.activityOpts} displayValue={opts.activityDV} onChange={sf("inconvenienceActivity")} />
            {s.inconvenienceActivity === "other" ? <TextInputField id="inconvenience-activity-other" label="Otro *" value={s.inconvenienceActivityOther} onChange={sf("inconvenienceActivityOther")} /> : null}
            <SingleSelectField id="inconvenience-type" label="Señale el inconveniente presentado *" value={s.inconvenienceType} options={opts.inconvTypeOpts} displayValue={opts.inconvTypeDV} onChange={sf("inconvenienceType")} />
            {s.inconvenienceType === "other" ? <TextInputField id="inconvenience-type-other" label="Otros *" value={s.inconvenienceTypeOther} onChange={sf("inconvenienceTypeOther")} /> : null}
          </>
        ) : null}
      </FormSection>
    </div>
  );
}
