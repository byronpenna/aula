import * as cdk from "aws-cdk-lib";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as sqs from "aws-cdk-lib/aws-sqs";
import { Construct } from "constructs";

export interface AsyncStackProps extends cdk.StackProps {
  vpc: ec2.IVpc;
  environmentName: string;
}

/**
 * Outbox + SQS + dispatcher (sección 9). El código real del dispatcher (lee
 * `outbox_events` con FOR UPDATE SKIP LOCKED, publica y marca éxito) es de la fase 5
 * (avisos/reportes); aquí solo se fija la topología async con un handler placeholder
 * para poder sintetizar y probar la infraestructura ahora.
 */
export class AsyncStack extends cdk.Stack {
  public readonly notificationsQueue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly dispatcherFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: AsyncStackProps) {
    super(scope, id, props);

    this.deadLetterQueue = new sqs.Queue(this, "NotificationsDlq", {
      retentionPeriod: cdk.Duration.days(14),
    });

    this.notificationsQueue = new sqs.Queue(this, "NotificationsQueue", {
      visibilityTimeout: cdk.Duration.seconds(180), // >= 6x timeout de función + batch window [S4].
      deadLetterQueue: { queue: this.deadLetterQueue, maxReceiveCount: 5 },
    });

    this.dispatcherFunction = new lambda.Function(this, "DispatcherFunction", {
      runtime: lambda.Runtime.PYTHON_3_12,
      handler: "index.handler",
      // Placeholder inline: el paquete real (app/workers/dispatcher.py) se conecta
      // cuando se implemente la fase 5. Mantenerlo inline evita bundling de Docker
      // durante `cdk synth` sin cuenta AWS configurada.
      code: lambda.Code.fromInline(
        "def handler(event, context):\n    return {'status': 'not_implemented_yet'}\n",
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 256,
      reservedConcurrentExecutions: 5,
      environment: { APP_ENV: props.environmentName },
    });

    this.notificationsQueue.grantSendMessages(this.dispatcherFunction);

    const rule = new events.Rule(this, "DispatcherSchedule", {
      schedule: events.Schedule.rate(cdk.Duration.minutes(1)),
      description: "Invoca el dispatcher de outbox cada minuto (sección 9).",
    });
    rule.addTarget(new targets.LambdaFunction(this.dispatcherFunction));

    new cdk.CfnOutput(this, "NotificationsQueueUrl", { value: this.notificationsQueue.queueUrl });
  }
}
