import { CallExpression, Node, ts, TypeChecker, VariableDeclaration } from 'ts-morph';

export const collectChildren: (n: Node) => Node[] = (n: Node) => {
    return [n, ...n.getChildren().flatMap(collectChildren)];
};

export const squeezeType = (ttype: ts.Type, checker: TypeChecker) => {
    const decs = (ttype.symbol.declarations ?? []) as ts.ClassLikeDeclarationBase[];
    const valueDec = (ttype.symbol.valueDeclaration as ts.ClassLikeDeclarationBase);

    const parents = [...decs, valueDec]
        .filter(el => !!el)
        .flatMap(dec => dec.heritageClauses
            ?.flatMap(cl => cl.types))
        .filter(el => !!el) as ts.ExpressionWithTypeArguments[];

    const uberparents = parents?.flatMap(p => getParentTypes(p, checker));

    const referredTypes = (parents ?? [])
        .flatMap(tt => tt.typeArguments?.map(p => getParentTypes(p, checker)) ?? [])
        .flatMap(el => el);

    return [
        ...(parents ?? []).map(tt => tt.expression.getText()),
        ...referredTypes,
        ...(uberparents ?? [])
    ];
};

// TODO: doesn't work
export const getVarType = (n: ts.Node, checker: TypeChecker) => {
    if (n.kind !== ts.SyntaxKind.VariableDeclaration) {
        return '<NOTVAR>';
    }

    const vartype = checker.compilerObject.getTypeAtLocation(n);

    const maybeTypes = (vartype as any).types as ts.Type[] | undefined;
    if (maybeTypes) {
        return maybeTypes.flatMap(t => squeezeType(t, checker))[0];
    }

    return '<NOSYMBOL>';
};

export const getParentTypes: (n: ts.Node, checker: TypeChecker) => string[] = (n: ts.Node, checker: TypeChecker) => {
    const ttype = checker.compilerObject.getTypeAtLocation(n);

    if (!ttype.symbol) {
        const jointTypes = (ttype as any as { types: ts.Type[] }).types;

        if (jointTypes) {
            return jointTypes.flatMap(tt => tt.symbol?.getName());
        }

        /**
         * the awkward `new func()()` doesn't have a type, but we
         * can try to extract one from the variable declaration
         */
        if (n.parent.kind !== ts.SyntaxKind.VariableDeclaration) {
            return ['<NOSYMBOL>'];
        }

        return [getVarType(n.parent, checker)];
        // const vartype = checker.compilerObject.getTypeAtLocation(n.parent);

        // const maybeTypes = (vartype as any).types as ts.Type[] | undefined;
        // if (maybeTypes) {
        //     return maybeTypes.flatMap(squeezeType);
        // }

        // return ['<NOSYMBOL>'];
    }

    const typeArgs = (n as any).typeArguments as ts.NodeArray<ts.TypeNode> | undefined;
    const genericArgs = (typeArgs ?? []).flatMap(p => getParentTypes(p, checker));

    return [
        ...squeezeType(ttype, checker),
        ...genericArgs
    ];
};

export const nodeTypeName = (n: Node, checker: TypeChecker) => {
    const ttype = checker.getTypeAtLocation(n);

    if (ttype.compilerType.symbol) {
        return ttype.compilerType.symbol.escapedName as string;
    }

    const subsym = checker.compilerObject.getSymbolAtLocation(n.compilerNode);

    if (subsym) {
        return subsym.escapedName as string;
    }

    if (n.compilerNode.parent.kind === ts.SyntaxKind.VariableDeclaration) {
        return getVarType(n.compilerNode.parent, checker);
    }

    console.error('falling back for', n.compilerNode.getText());
    return n.compilerNode.getText();
};

export const getRootVarDeclaration = (n: Node) => n
    .getAncestors()
    .filter(ans => ans.isKind(ts.SyntaxKind.VariableDeclaration)) as VariableDeclaration[];

export const getRootCallDeclaration = (n: Node) => n
    .getAncestors()
    .filter(ans => ans.isKind(ts.SyntaxKind.CallExpression)) as CallExpression[];

export const getParentVarDeclaration = (n: Node) => n
    .getParentIfKind(ts.SyntaxKind.VariableDeclaration);

export const first = <T>(arr?: T[]) => arr?.length ? arr[0] : undefined;