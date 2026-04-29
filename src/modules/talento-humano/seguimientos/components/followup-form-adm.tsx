"use client";

import { FormSection } from "@/shared/forms/form-section";
import { TextInputField } from "@/shared/forms/text-input-field";
import { TextareaField } from "@/shared/forms/textarea-field";
import { SingleSelectField } from "@/shared/filters/single-select-field";

export type AdmFormState = {
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
  adaptOpts: Opts; adaptDV: DV;
  satisfactionOpts: Opts; satisfactionDV: DV;
  retentionOpts: Opts; retentionDV: DV;
  workAspectOpts: Opts; workAspectDV: DV;
};

export function FollowupFormAdm({ state, setField, ...opts }: Props) {
  const s = state;
  const sf = <K extends keyof AdmFormState>(k: K) => (v: AdmFormState[K]) => setField(k, v);

  return (
    <div className="grid gap-6 2xl:grid-cols-2">
      <FormSection title="Primeros dias desde el ingreso">
        <SingleSelectField id="induction-sufficient" label="Adaptacion inicial - ¿La induccion recibida fue suficiente? *" value={s.inductionSufficient} options={opts.adaptOpts} displayValue={opts.adaptDV} onChange={sf("inductionSufficient")} />
        <SingleSelectField id="transport-problem" label="Adaptacion inicial - ¿Has tenido problemas para llegar al trabajo? *" value={s.transportProblem} options={opts.adaptOpts} displayValue={opts.adaptDV} onChange={sf("transportProblem")} />
        <SingleSelectField id="team-welcome" label="Adaptacion inicial - ¿Te sentiste bien recibido por tu equipo? *" value={s.teamWelcome} options={opts.adaptOpts} displayValue={opts.adaptDV} onChange={sf("teamWelcome")} />
        <TextareaField id="adaptation-neg-obs" label="Observaciones en que la respuesta sea no" value={s.adaptationNegObs} onChange={sf("adaptationNegObs")} rows={2} />
        <TextareaField id="adaptation-suggestion" label="¿Tiene alguna sugerencia o requerimiento para poder mejorar su estadia dentro de la empresa?" value={s.adaptationSuggestion} onChange={sf("adaptationSuggestion")} rows={2} />
      </FormSection>

      <FormSection title="Final de mes - Periodo de prueba">
        <SingleSelectField id="role-clarity" label="Nivel de satisfaccion - Claridad en funciones *" value={s.roleClarity} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("roleClarity")} />
        <SingleSelectField id="work-environment" label="Nivel de satisfaccion - Ambiente de trabajo *" value={s.workEnvironment} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("workEnvironment")} />
        <SingleSelectField id="equipment-satisfaction" label="Nivel de satisfaccion - Equipos e implementos *" value={s.equipmentSatisfaction} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("equipmentSatisfaction")} />
        <TextareaField id="probation-suggestion" label="¿Tiene alguna sugerencia o requerimiento para poder mejorar su estadia dentro de la empresa?" value={s.probationSuggestion} onChange={sf("probationSuggestion")} rows={2} />
      </FormSection>

      <FormSection title="ADM seguimiento bimensual - trimestral">
        <SingleSelectField id="recent-work-satisfaction" label="Nivel de satisfaccion con el trabajo en los ultimos meses *" value={s.recentWorkSatisfaction} options={opts.satisfactionOpts} displayValue={opts.satisfactionDV} onChange={sf("recentWorkSatisfaction")} />
        <SingleSelectField id="work-aspect" label="¿Que aspectos de tu trabajo te gustaria que mejoraran? *" value={s.workAspectToImprove} options={opts.workAspectOpts} displayValue={opts.workAspectDV} onChange={sf("workAspectToImprove")} />
        {s.workAspectToImprove === "other" ? <TextInputField id="work-aspect-other" label="Otros *" value={s.workAspectOther} onChange={sf("workAspectOther")} /> : null}
        <TextareaField id="dissatisfaction-detail" label="Detalle el porque de su disgusto de la pregunta anterior" value={s.dissatisfactionDetail} onChange={sf("dissatisfactionDetail")} rows={2} />
        <SingleSelectField id="final-retention" label="¿Por cuanto tiempo mas le gustaria seguir trabajando en la empresa? *" value={s.finalRetentionIntention} options={opts.retentionOpts} displayValue={opts.retentionDV} onChange={sf("finalRetentionIntention")} />
        <TextareaField id="final-stay-suggestion" label="¿Tiene alguna sugerencia o requerimiento para poder mejorar su estadia dentro de la empresa?" value={s.finalStaySuggestion} onChange={sf("finalStaySuggestion")} rows={2} />
      </FormSection>
    </div>
  );
}
