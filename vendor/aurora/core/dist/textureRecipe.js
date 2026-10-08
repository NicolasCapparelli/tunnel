import { AuroraFormatError } from './errors.js';
import { isJsonInteger, recipeFields, recipeList, recipeMap, recipeText } from './recipe.js';
import { AuroraTexture, AuroraTextureContract, AuroraTextureStarter } from './texture.js';
import { TextureCodec } from './textureCodec.js';
import { AuroraEnumToken, tokenOfType } from './token.js';
const TEXTURE_TYPES = [
    'dimension',
    'number',
    'fontFamily',
    'fontWeight',
    'duration',
    'cubicBezier',
    'strokeStyle',
    'border',
    'shadow',
    'typography',
    'boolean',
    'enum',
];
function sameShape(a, b) {
    if (a.id !== b.id || a.version !== b.version || a.tokens.size !== b.tokens.size)
        return false;
    for (const token of a.tokens.values()) {
        const other = b.tokens.get(token.path);
        if (other === undefined || other.type !== token.type)
            return false;
        if (token.type === 'enum' && token.values.join('\n') !== other.values.join('\n')) {
            return false;
        }
    }
    return true;
}
/** Portable texture recipe v1: a JSON description of one texture. See `spec/texture-recipe-v1.md`. */
export const AuroraTextureRecipe = Object.freeze({
    /**
     * Decodes a texture. Pass the app's [contract] so several recipes share one
     * contract instance (required by runtimes); the recipe's `contract` must then
     * describe exactly that contract. Without it, the recipe's contract is built fresh.
     */
    decode(input, contract) {
        const recipe = recipeMap(input, 'texture recipe');
        recipeFields(recipe, ['schemaVersion', 'kind', 'id', 'name', 'base', 'contract', 'values'], 'texture recipe');
        if (recipe['schemaVersion'] !== 1)
            throw new AuroraFormatError('Expected texture recipe schemaVersion 1');
        if (recipe['kind'] !== 'texture')
            throw new AuroraFormatError('Expected texture recipe kind "texture"');
        const declared = AuroraTextureRecipe.decodeContract(recipeMap(recipe['contract'] ?? { id: 'aurora-texture-foundation' }, 'contract'));
        if (contract !== undefined && !sameShape(contract, declared)) {
            throw new AuroraFormatError(`Recipe contract does not match texture contract ${contract.id}`);
        }
        const target = contract ?? declared;
        const base = recipe['base'] ?? 'material';
        if (base !== 'material' && base !== 'none')
            throw new AuroraFormatError('base must be "material" or "none"');
        const codec = new TextureCodec(target, true);
        const values = new Map(base === 'material' ? AuroraTextureStarter.material : []);
        for (const [path, value] of Object.entries(recipeMap(recipe['values'] ?? {}, 'values'))) {
            const token = target.tokens.get(path);
            if (token === undefined)
                throw new AuroraFormatError(`Undeclared token ${path}`);
            values.set(token, codec.decode(token, value, path));
        }
        return new AuroraTexture({
            contract: target,
            id: recipeText(recipe['id'], 'id'),
            name: recipeText(recipe['name'], 'name'),
            values,
        });
    },
    /** The recipe JSON for a texture value, such as a value read from a texture. Dimensions keep their unit. */
    encodeValue(value) {
        return new TextureCodec(undefined, true).encode(value);
    },
    /** Decodes a recipe `contract` object into a texture contract. */
    decodeContract(definition) {
        const map = recipeMap(definition, 'contract');
        recipeFields(map, ['id', 'version', 'extensions'], 'contract');
        const version = map['version'] ?? 1;
        if (!isJsonInteger(version))
            throw new AuroraFormatError('Contract version must be an integer');
        const extensions = [];
        for (const item of recipeList(map['extensions'] ?? [], 'extensions')) {
            const token = recipeMap(item, 'extension');
            const type = recipeText(token['type'], 'extension type');
            recipeFields(token, ['path', 'description', 'type', ...(type === 'enum' ? ['values'] : [])], 'extension');
            if (!TEXTURE_TYPES.includes(type)) {
                throw new AuroraFormatError(`Unsupported texture token type ${type}`);
            }
            const path = recipeText(token['path'], 'path');
            const description = recipeText(token['description'], 'description');
            if (type === 'enum') {
                const values = recipeList(token['values'], 'values').map((value) => recipeText(value, 'enum value'));
                extensions.push(new AuroraEnumToken(path, { description, values }));
            }
            else {
                extensions.push(tokenOfType(type, path, description));
            }
        }
        return new AuroraTextureContract({ id: recipeText(map['id'], 'contract.id'), version, extensions });
    },
});
