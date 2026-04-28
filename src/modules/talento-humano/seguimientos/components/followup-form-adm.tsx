"use client";

import { FormSection } from "@/shared/forms/form-section";
import { TextInputField } from "@/shared/forms/text-input-field";
import { TextareaField } from "@/shared/forms/textarea-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";

export type AdmFormState = {
  admFreq: string;
  inductionSufficient: string;
  transportProblem: string;
  teamWelcome: string;
  adaptationNegObs: string;
  adaptationSuggestion: string;
  roleClarity: string;
  workEnvironment: string;
  equipmentSatisfaction: string;
  probationSuggestion: string;
  recentWorkSatisfaction: string;
  workAspectToImprove: string;
  workAspectOther: string;
  dissatisfactionDetail: string;
  finalRetentionIntention: string;
  finalStaySuggestion: string;
};

type SetField = <K extends keyof AdmFormState>(key: K, value: AdmFormState[K]) => void;
type Opts = string[];
type DV = (v: string) => string;

type Props = {
  state: AdmFormState;
  setField: SetField;
  admFreqOpts: Opts; admFreqDV: DV;
  yesNoOpts: Opts; yesNoDV: DV;
  adaptOpts: Opts; adaptDV: DV;
  satisfactionOpts: Opts; satisfactionDV: DV;
  retentionOpts: Opts; retentionDV: DV;
  workAspectOpts: Opts; workAspectDV: DV;
};

export function FollowupFormAdm({ state, setField, ...opts }: Props) {
  const s = state;
  const sf = <K extends keyof AdmFormState>(k: K) => (v: AdmFormState[K]) => setField(k, v);

  return (
    <>
      <FormSection title="Seguimiento Administrativo">
        <SingleSelectField id="adm-freq" label="Frecuencia de seguimiento *" value={s.admFreq} options={opts.admFreqOpts} displayValue={opts.admFreqDV} onChange={sf("admFreq")} />
        <SingleSelectField id="induction-sufficient" label="¿Inducción suficiente?" value={s.inductionSufficient} options={opts.adaptOpts} displayValue={opts.adaptDV} onChange={sf("inductionSufficient")} />
        <SingleSelectField id="transport-problem" label="¿Problema de transporte?" value={s.transportProblem} options={opts.yesNoOpts} displayValue={opts.yesNoDV} onChange={sf("transportProblem")} />
        <SingleSelectField id="team-welcome" label="¿Bienvenida del equipo?" value={s.teamWelcome} options={opts.adaptOpts} displayValue={opts.adaptDV} onChange={sf("teamWelcome")} />
        <TextareaField id="adaptation-neg-obs" label="Aspectos negativos de adaptación" value={s.adaptationNegObs} onChange={sf("adaptationNegObs")} rows={2} />
        <TextareaField id="adaptation-suggestion" label="Sugerencia de adaptación" value={s.adaptationSuggestion} onChange={sf("adaptationSuggestion")} rows={2} />
      </FormSection>

      <FormSection title="Satisfacción">
        <SingleSelectField id="role-clarity" label="Claridad del rol" value={s.roleClarity} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("roleClarity")} />
        <SingleSelectField id="work-environment" label="Ambiente de trabajo" value={s.workEnvironment} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("workEnvironment")} />
        <SingleSelectField id="equipment-satisfaction" label="Equipos y recursos" value={s.equipmentSatisfaction} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("equipmentSatisfaction")} />
        <TextareaField id="probation-suggestion" label="Sugerencia periodo prueba" value={s.probationSuggestion} onChange={sf("probationSuggestion")} rows={2} />
        <SingleSelectField id="recent-work-satisfaction" label="Satisfacción últimos meses" value={s.recentWorkSatisfaction} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("recentWorkSatisfaction")} />
      </FormSection>

      <FormSection title="Mejora y permanencia">
        <SingleSelectField id="work-aspect" label="Aspecto principal a mejorar" value={s.workAspectToImprove} options={opts.workAspectOpts} displayValue={opts.workAspectDV} onChange={sf("workAspectToImprove")} />
        {s.workAspectToImprove === "other" && (
          <TextInputField id="work-aspect-other" label="Especificar aspecto *" value={s.workAspectOther} onChange={sf("workAspectOther")} />
        )}
        <TextareaField id="dissatisfaction-detail" label="Detalle de insatisfacción" value={s.dissatisfactionDetail} onChange={sf("dissatisfactionDetail")} rows={2} />
        <SingleSelectField id="final-retention" label="Intención de permanencia final" value={s.finalRetentionIntention} options={opts.retentionOpts} displayValue={opts.retentionDV} onChange={sf("finalRetentionIntention")} />
        <TextareaField id="final-stay-suggestion" label="Sugerencia de permanencia" value={s.finalStaySuggestion} onChange={sf("finalStaySuggestion")} rows={2} />
      </FormSection>
    </>
  );
}
