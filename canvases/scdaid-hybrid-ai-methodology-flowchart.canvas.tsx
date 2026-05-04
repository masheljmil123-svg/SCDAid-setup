import {
  Card,
  CardBody,
  CardHeader,
  Divider,
  Grid,
  H1,
  H2,
  H3,
  mergeStyle,
  Row,
  Stack,
  Text,
  useHostTheme,
} from "cursor/canvas";
import { useId, type CSSProperties, type ReactNode } from "react";

function ArrowRight({ color }: { color: string }) {
  const mid = `arr-${useId().replace(/:/g, "")}`;
  return (
    <svg width="44" height="20" viewBox="0 0 44 20" aria-hidden style={{ flexShrink: 0 }}>
      <defs>
        <marker id={mid} markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
          <polygon points="0 0, 7 3.5, 0 7" fill={color} />
        </marker>
      </defs>
      <line
        x1="2"
        y1="10"
        x2="34"
        y2="10"
        stroke={color}
        strokeWidth="1.5"
        markerEnd={`url(#${mid})`}
      />
    </svg>
  );
}

function ColumnShell({
  title,
  subtitle,
  accent,
  children,
}: {
  title: string;
  subtitle: string;
  accent: "blue" | "green" | "violet";
  children: ReactNode;
}) {
  const theme = useHostTheme();
  const accentColor =
    accent === "blue"
      ? theme.accent.primary
      : accent === "green"
        ? theme.diff.stripAdded
        : theme.text.link;
  const wash: CSSProperties =
    accent === "blue"
      ? { backgroundColor: theme.fill.secondary }
      : accent === "green"
        ? { backgroundColor: theme.diff.insertedLine }
        : { backgroundColor: theme.fill.tertiary };

  return (
    <Stack
      gap={12}
      style={mergeStyle(
        {
          borderRadius: 6,
          border: `1px solid ${theme.stroke.tertiary}`,
          borderLeft: `4px solid ${accentColor}`,
          padding: 14,
          minWidth: 0,
          height: "100%",
        },
        wash,
      )}
    >
      <Stack gap={4}>
        <H2 style={{ fontSize: "16px", lineHeight: "22px", margin: 0 }}>{title}</H2>
        <Text tone="secondary" size="small">
          {subtitle}
        </Text>
      </Stack>
      <Divider />
      {children}
    </Stack>
  );
}

function Bullet({ children }: { children: ReactNode }) {
  return (
    <Text size="small" style={{ marginLeft: 10, textIndent: -10 }}>
      {"\u2022 "}
      {children}
    </Text>
  );
}

export default function SCDAidHybridAIMethodologyFlowchart() {
  const theme = useHostTheme();

  return (
    <Stack gap={20} style={{ maxWidth: 1200, margin: "0 auto" }}>
      <Stack gap={8}>
        <H1 style={{ margin: 0 }}>SCDAid Hybrid AI Methodology &amp; Decision Workflow</H1>
        <Text tone="secondary" size="small">
          Left-to-right data flow: patient inputs are interpreted by parallel engines, then fused into
          guardrail-adjusted clinical outputs. SCAIA Chat supports transparency; it does not replace the
          engines.
        </Text>
      </Stack>

      <Row gap={10} align="center" justify="center" wrap style={{ padding: "8px 0" }}>
        <Text size="small" weight="medium">
          Inputs
        </Text>
        <ArrowRight color={theme.stroke.primary} />
        <Text size="small" weight="medium">
          Core processing
        </Text>
        <ArrowRight color={theme.stroke.primary} />
        <Text size="small" weight="medium">
          Final outputs
        </Text>
      </Row>

      <Grid columns="minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr)" gap={16} align="stretch">
        <ColumnShell
          title="1. Inputs: Patient Data"
          subtitle="Structured features consumed by CPIC rules, ML models, and guardrails."
          accent="blue"
        >
          <Stack gap={12}>
            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>Genetic data</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={6}>
                  <Bullet>CYP2D6 alleles and diplotype context</Bullet>
                  <Bullet>Co-administered CYP2D6 inhibitors (phenoconversion inputs)</Bullet>
                </Stack>
              </CardBody>
            </Card>
            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>Clinical data</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={6}>
                  <Bullet>Age, weight, pain severity</Bullet>
                  <Bullet>eGFR, SpO2</Bullet>
                  <Bullet>Suspected ACS, inflammation markers</Bullet>
                  <Bullet>Previous codeine failure, morphine allergy</Bullet>
                  <Bullet>Concurrent sedatives, opioid tolerance</Bullet>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </ColumnShell>

        <ColumnShell
          title="2. Core Processing Engines"
          subtitle="Rule-based pharmacogenomics, supervised ML, mandatory safety layer, and adjunct chat."
          accent="green"
        >
          <Stack gap={12}>
            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>CPIC-based CYP2D6 engine</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={6}>
                  <Text size="small">Rule-based (non-ML): activity score, genotype-to-phenotype map, phenoconversion.</Text>
                </Stack>
              </CardBody>
            </Card>

            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>Supervised ML ensemble</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={8}>
                  <Text size="small">
                    Three outcome-specific classifiers. Each uses soft voting over Logistic Regression (explainable
                    probabilities) and Random Forest (nonlinear clinical interactions).
                  </Text>
                  <Stack gap={4}>
                    <Bullet>Functional CYP2D6 phenotype prediction</Bullet>
                    <Bullet>Analgesic recommendation</Bullet>
                    <Bullet>Safety risk classification</Bullet>
                  </Stack>
                </Stack>
              </CardBody>
            </Card>

            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>Clinical guardrails / safety override</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={6}>
                  <Bullet>eGFR &lt; 30: prefer fentanyl</Bullet>
                  <Bullet>eGFR 30–59: prefer hydromorphone</Bullet>
                  <Bullet>Morphine allergy: block morphine</Bullet>
                  <Bullet>CYP2D6 PM or UM: avoid codeine and tramadol</Bullet>
                  <Bullet>Low SpO2, suspected ACS, or sedatives: monitoring alerts</Bullet>
                </Stack>
              </CardBody>
            </Card>

            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>SCAIA Chat</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Text size="small">
                  Conversational explanation and knowledge-base support. Adjunct to care—not the primary prediction
                  engine.
                </Text>
              </CardBody>
            </Card>
          </Stack>
        </ColumnShell>

        <ColumnShell
          title="3. Final Outputs"
          subtitle="Clinician-facing synthesis after engines and guardrails."
          accent="violet"
        >
          <Stack gap={12}>
            <Card variant="borderless" style={{ backgroundColor: theme.bg.elevated }}>
              <CardHeader>Decision package</CardHeader>
              <CardBody style={{ paddingTop: 0 }}>
                <Stack gap={8}>
                  <H3 style={{ fontSize: "13px", lineHeight: "18px", margin: 0, fontWeight: 590 }}>
                    Primary results
                  </H3>
                  <Stack gap={6}>
                    <Bullet>Final CYP2D6 phenotype (CPIC + ML + guardrails as applicable)</Bullet>
                    <Bullet>Predicted analgesic recommendation, adjusted by guardrails</Bullet>
                    <Bullet>Final safety risk level</Bullet>
                    <Bullet>Monitoring requirements (alerts from low SpO2 / ACS risk / sedatives, etc.)</Bullet>
                  </Stack>
                  <Divider />
                  <H3 style={{ fontSize: "13px", lineHeight: "18px", margin: 0, fontWeight: 590 }}>
                    Transparency
                  </H3>
                  <Bullet>Explanation and context via SCAIA Chat</Bullet>
                </Stack>
              </CardBody>
            </Card>
          </Stack>
        </ColumnShell>
      </Grid>

      <Text tone="tertiary" size="small">
        Edit this canvas source to update labels, rules, or module names. Arrows summarize aggregate flow; internal
        fusion logic is implementation-specific.
      </Text>
    </Stack>
  );
}
