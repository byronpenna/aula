import * as cdk from "aws-cdk-lib";
import * as cloudwatch from "aws-cdk-lib/aws-cloudwatch";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface ObservabilityStackProps extends cdk.StackProps {
  apiFunction: lambda.IFunction;
  dispatcherFunction: lambda.IFunction;
  dlq: sqs.IQueue;
  environmentName: string;
}

/**
 * Dashboard y alarmas base (sección 14). Los destinatarios de las alarmas (SNS,
 * email) no están definidos todavía (sección 21: "Destinatarios de alarmas ...
 * pendiente de cerrar"); las alarmas existen pero sin acción configurada hasta que
 * el propietario los confirme.
 */
export class ObservabilityStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ObservabilityStackProps) {
    super(scope, id, props);

    const dashboard = new cloudwatch.Dashboard(this, "Dashboard", {
      dashboardName: `aula-${props.environmentName}`,
    });

    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: "API Lambda - errores y throttles",
        left: [props.apiFunction.metricErrors(), props.apiFunction.metricThrottles()],
      }),
      new cloudwatch.GraphWidget({
        title: "API Lambda - duración (p95)",
        left: [props.apiFunction.metricDuration({ statistic: "p95" })],
      }),
      new cloudwatch.GraphWidget({
        title: "DLQ de notificaciones - mensajes visibles",
        left: [props.dlq.metricApproximateNumberOfMessagesVisible()],
      }),
    );

    new cloudwatch.Alarm(this, "ApiErrorRateAlarm", {
      metric: props.apiFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 5,
      evaluationPeriods: 3,
      alarmDescription: "Tasa de error 5xx elevada en la API (sección 14).",
    });

    new cloudwatch.Alarm(this, "DlqNotEmptyAlarm", {
      metric: props.dlq.metricApproximateNumberOfMessagesVisible(),
      threshold: 0,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
      evaluationPeriods: 1,
      alarmDescription: "DLQ > 0: hay mensajes que agotaron reintentos (sección 14).",
    });

    new cloudwatch.Alarm(this, "DispatcherErrorsAlarm", {
      metric: props.dispatcherFunction.metricErrors({ period: cdk.Duration.minutes(5) }),
      threshold: 1,
      evaluationPeriods: 3,
      alarmDescription: "Errores repetidos en el dispatcher de outbox (sección 9, 14).",
    });
  }
}
