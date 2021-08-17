#!/usr/bin/env node
import { Command } from "commander";
import {
  buildClientSchema,
  getIntrospectionQuery,
  getNamedType,
  GraphQLObjectType,
  IntrospectionQuery,
  isLeafType,
} from "graphql";
import { request } from "graphql-request";

const seenTypes = new Set<string>();

function visit(type: unknown) {
  seenTypes.add((type as any).toString());
  if (!isLeafType(type)) {
    const fields = (type as GraphQLObjectType).getFields();
    Object.values(fields).forEach((field) => {
      visit(getNamedType(field.type));
      if (field.args) {
        field.args.forEach((arg) => {
          visit(getNamedType(arg.type));
        });
      }
    });
  }
}

async function findUnusedTypes(introspectionUrl: string) {
  const introspectionResult = await request<IntrospectionQuery>(
    introspectionUrl,
    getIntrospectionQuery()
  );

  const schema = buildClientSchema(introspectionResult);
  const allTypes: string[] = Object.keys(schema.getTypeMap());

  const queryType = schema.getQueryType();
  if (queryType) {
    visit(queryType);
  }

  const mutationType = schema.getMutationType();
  if (mutationType) {
    visit(mutationType);
  }

  const subscriptionType = schema.getSubscriptionType();
  if (subscriptionType) {
    visit(subscriptionType);
  }

  const orphans = new Set([...allTypes].filter((x) => !seenTypes.has(x)));
  console.log("Orphan types:");
  console.log(orphans);
}

const program = new Command();

program
  .argument("<introspectionUrl>", "introspection URL")
  .action(async (introspectionUrl) => {
    await findUnusedTypes(introspectionUrl);
  });

program.parse(process.argv);
