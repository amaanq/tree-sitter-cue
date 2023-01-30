// deno-lint-ignore-file ban-ts-comment
/* eslint-disable arrow-parens */
/* eslint-disable camelcase */
/* eslint-disable-next-line spaced-comment */
/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

/**
 * Creates a rule to match one or more of the rules separated by the separator
 * and optionally adds a trailing separator (default is false).
 *
 * @param {Rule} rule
 * @param {string} separator - The separator to use.
 * @param {boolean?} trailing_separator - Whether to allow a trailing separator or not.
 *
 * @return {SeqRule}
 *
 */
const list_seq = (rule, separator, trailing_separator = false) =>
  trailing_separator ?
    seq(rule, repeat(seq(separator, rule)), optional(separator)) :
    seq(rule, repeat(seq(separator, rule)));

/**
 * Creates a rule to match one or more of the rules separated by a comma
 *
 * @param {Rule} rule
 * @param {boolean?} trailing_separator - Whether to allow a trailing separator or not.
 *
 * @return {SeqRule}
 */
const comma_sep1 = (rule, trailing_separator = false) => list_seq(rule, ',', trailing_separator);

/**
 * Creates a rule to match zero or more of the rules separated by a comma
 *
 * @param {Rule} rule
 * @param {boolean?} trailing_separator - Whether to allow a trailing separator or not.
 *
 * @return {ChoiceRule}
 */
const comma_sep = (rule, trailing_separator = false) => optional(list_seq(rule, ',', trailing_separator));


const PREC = {
  // primary: 10,
  or: 3,
  and: 4,
  not: 5,
  compare: 6,
  bitwise_or: 7,
  bitwise_and: 8,
  plus: 9,
  times: 10,
  unary: 11,
};

const unicodeLetter = /\p{L}/;
const unicodeDigit = /[0-9]/;

const letter = choice(unicodeLetter, '$', '_');

const newline = '\n';
const terminator = choice(newline, ',');

const hexDigit = /[0-9a-fA-F]/;
const octalDigit = /[0-7]/;
const decimalDigit = /[0-9]/;
const binaryDigit = /[01]/;

const multiplier = seq(
  choice('K', 'M', 'G', 'T', 'P'),
  optional('i'),
);

const hexDigits = seq(hexDigit, repeat(seq(optional('_'), hexDigit)));
const octalDigits = seq(octalDigit, repeat(seq(optional('_'), octalDigit)));
const decimalDigits = seq(decimalDigit, repeat(seq(optional('_'), decimalDigit)));
const binaryDigits = seq(binaryDigit, repeat(seq(optional('_'), binaryDigit)));

const hexLiteral = seq('0', choice('x', 'X'), optional('_'), hexDigits);
const octalLiteral = seq('0', optional(choice('o', 'O')), optional('_'), octalDigits);
const decimalLiteral = choice('0', seq(/[1-9]/, optional(seq(optional('_'), decimalDigits))));
const binaryLiteral = seq('0', choice('b', 'B'), optional('_'), binaryDigits);
const siLiteral = choice(
  seq(decimalLiteral, optional(repeat(seq('.', decimalLiteral))), multiplier),
  seq('.', decimalLiteral, multiplier),
);

const decimalExponent = seq(choice('e', 'E'), optional(choice('+', '-')), decimalDigits);
const decimalFloatLiteral = choice(
  seq(decimalDigits, '.', optional(decimalDigits), optional(decimalExponent)),
  seq(decimalDigits, decimalExponent),
  seq('.', decimalDigits, optional(decimalExponent)),
);

const hexExponent = seq(choice('p', 'P'), optional(choice('+', '-')), decimalDigits);
const hexMantissa = choice(
  seq(optional('_'), hexDigits, '.', optional(hexDigits)),
  seq(optional('_'), hexDigits),
  seq('.', hexDigits),
);
const hexFloatLiteral = seq('0', choice('x', 'X'), hexMantissa, hexExponent);

const intLiteral = choice(binaryLiteral, decimalLiteral, octalLiteral, hexLiteral, siLiteral);
const floatLiteral = choice(decimalFloatLiteral, hexFloatLiteral);

const primitives = [
  'number',
  'float',
  'float32',
  'float64',
  'uint',
  'uint8',
  'uint16',
  'uint32',
  'uint64',
  'uint128',
  'int',
  'int8',
  'int16',
  'int32',
  'int64',
  'int128',
  'string',
  'bytes',
  'bool',
];

module.exports = grammar({
  name: 'cue',

  extras: $ => [
    /\s/,
    $.comment,
  ],

  externals: $ => [
    $._multi_str_content,
    $._multi_bytes_content,
    $._raw_str_content,
    $._raw_bytes_content,
    $._multi_raw_str_content,
    $._multi_raw_bytes_content,
  ],

  word: $ => $.identifier,

  rules: {
    source_file: $ => seq(
      optional($.attribute),
      optional($.package_clause),
      optional(repeat($.import_declaration)),
      repeat(seq($._declaration, terminator)),
    ),

    package_clause: $ => seq(
      'package',
      alias($.identifier, $.package_identifier),
    ),

    import_declaration: $ => seq(
      'import',
      choice(
        $.import_spec,
        $.import_spec_list,
      ),
    ),

    import_spec: $ => seq(
      optional(field('name', choice(
        '.',
        $.blank_identifier,
        alias($.identifier, $.package_identifier),
      ))),
      field('path', $._string_lit),
    ),

    import_spec_list: $ => seq(
      '(',
      repeat(seq(
        $.import_spec,
        terminator,
      )),
      ')',
    ),

    blank_identifier: () => '_',

    identifier: () => token(seq(
      optional(choice('_#', '#', '_')),
      letter,
      repeat(choice(letter, unicodeDigit)),
    )),

    attribute: $ => seq(
      '@', $.identifier, '(', repeat($.attr_token), ')',
    ),
    attr_token: () => /[^\(\)\[\]{}]+/,

    // identifier: $ => choice(
    //   $._identifier,
    //   $.hidden_identifier,
    //   $.definition,
    //   $.hidden_definition,
    // ),

    // _identifier: $ => token(seq(
    //   letter, repeat(choice(letter, unicodeDigit, '$'))
    // )),

    // // https://github.com/tree-sitter/tree-sitter/issues/449
    // hidden_identifier: $ => token(seq(
    //  '_', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
    // )),

    // definition: $ => token(seq(
    //  '#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
    // )),

    // hidden_definition: $ => token(seq(
    //  '_#', field('name', seq(letter, repeat(choice(letter, unicodeDigit, '$'))))
    // )),

    qualified_identifier: $ => seq(
      alias($.identifier, $.package_identifier),
      '.',
      $.identifier,
    ),

    escape_char: () => token.immediate(seq(
      '\\',
      seq(choice('a', 'b', 'f', 'n', 'r', 't', 'v', '\\', '\'', '"')),
    )),

    escape_byte: () => token.immediate(seq(
      '\\',
      optional('#'),
      choice(
        /\d{2,3}/, // octal byte value
        /x[0-9a-fA-F]{2,}/, // hex byte value
      ),
    )),

    escape_unicode: () => token.immediate(seq(
      '\\',
      optional('#'),
      choice(
        /u[0-9a-fA-F]{4}/,
        /U[0-9a-fA-F]{8}/,
      ),
    )),

    _string_lit: $ => choice(
      $.simple_string_lit,
      $.multiline_string_lit,
      $.simple_bytes_lit,
      $.multiline_bytes_lit,
      $.simple_raw_string_lit,
      $.multiline_raw_string_lit,
      $.simple_raw_bytes_lit,
      $.multiline_raw_bytes_lit,
    ),

    simple_string_lit: $ => seq(
      '"',
      repeat(choice(
        token.immediate(prec(1, /[^"\n\\]+/)),
        $.interpolation,
        $.escape_unicode,
        $.escape_char,
      )),
      '"',
    ),

    simple_raw_string_lit: $ => seq(
      '#"',
      repeat(choice(
        $._raw_str_content,
        $.raw_interpolation,
      )),
      '"#',
    ),

    simple_bytes_lit: $ => seq(
      '\'',
      repeat(choice(
        token.immediate(prec(1, /[^'\n\\]+/)),
        $.interpolation,
        $.escape_byte,
        $.escape_unicode,
        $.escape_char,
      )),
      '\'',
    ),

    simple_raw_bytes_lit: $ => seq(
      '#\'',
      repeat(choice(
        $._raw_bytes_content,
        $.raw_interpolation,
      )),
      '\'#',
    ),

    multiline_string_lit: $ => seq(
      token('"""'),
      repeat(choice(
        $._multi_str_content,
        $.interpolation,
        // $.escape_char,
        // $.escape_unicode,
      )),
      token('"""'),
    ),

    multiline_raw_string_lit: $ => seq(
      token('#"""'),
      repeat(choice(
        $._multi_raw_str_content,
        $.raw_interpolation,
      )),
      token('"""#'),
    ),

    multiline_bytes_lit: $ => seq(
      token('\'\'\''),
      repeat(choice(
        $._multi_bytes_content,
        $.interpolation,
        // $.escape_byte,
        // $.escape_unicode,
        // $.escape_char,
      )),
      token('\'\'\''),
    ),

    multiline_raw_bytes_lit: $ => seq(
      token('#\'\'\''),
      repeat(choice(
        $._multi_raw_bytes_content,
        $.raw_interpolation,
      )),
      token('\'\'\'#'),
    ),

    interpolation: $ => seq('\\(', $.expression, ')'),

    raw_interpolation: $ => seq('\\#(', $.expression, ')'),

    builtin: () => choice(
      'len',
      'close',
      'and',
      'or',
      'div',
      'mod',
      'quo',
      'rem',
    ),

    primitive: () => choice(...primitives),

    top_lit: () => token('_'),

    bottom_lit: () => token('_|_'),

    boolean: () => choice('true', 'false'),

    null: () => 'null',

    int_lit: () => token(intLiteral),

    float_lit: () => token(floatLiteral),

    _declaration: $ => choice(
      $.field,
      $.ellipsis,
      $._embedding,
      $.let_clause,
    ),

    _list_elem: $ => prec.right(choice(
      $.ellipsis,
      seq($._embedding, optional(repeat(seq(',', $._embedding))), optional(seq(',', $.ellipsis)), optional(',')),
    )),

    list_lit: $ => seq('[', repeat($._list_elem), ']'),

    struct_lit: $ => seq(
      '{',
      repeat(
        seq(choice($._declaration, $.attribute), optional(',')),
      ),
      '}',
    ),

    ellipsis: $ => prec.right(
      seq(
        '...',
        optional($.expression),
      ),
    ),

    _embedding: $ => prec.right(choice($.comprehension, $._alias_expr)),

    label_name: $ => choice($.identifier, $.simple_string_lit),

    label_expr: $ => choice(
      seq($.label_name, optional('?')),
      seq('[', $._alias_expr, ']'),
    ),

    label: $ =>
      seq(
        optional(seq(field('alias', $.identifier), '=')),
        $.label_expr,
      ),

    field: $ => prec.right(
      seq(
        repeat1(seq($.label, ':')),
        $._value,
        optional($.attribute),
      ),
    ),

    _value: $=> alias($._alias_expr, $.value),

    for_clause: $ =>
      seq(
        'for',
        choice($.identifier, $.blank_identifier),
        optional(seq(',', choice($.identifier, $.blank_identifier))),
        'in', $.expression,
      ),

    guard_clause: $ => seq('if', field('condition', $.expression)),

    let_clause: $ => seq('let', field('left', $.identifier), '=', field('right', $.expression)),

    _clause: $ => choice($.for_clause, $.guard_clause, $.let_clause),

    comprehension: $ =>
      seq(
        choice($.for_clause, $.guard_clause),
        repeat(seq(optional(','), $._clause)),
        $.struct_lit,
      ),

    _alias_expr: $ =>
      seq(
        optional(seq(field('alias', $.identifier), '=')),
        $.expression,
      ),

    expression: $ => prec.left(1, choice(
      $.comparison_operator,
      $.not_operator,
      $.boolean_operator,
      $.primary_expression,
      $.binary_operator,
    )),

    primary_expression: $ =>
      choice(
        $.binary_operator,
        $._operand,
        $.unary_operator,
        $.index_expression,
        $.selector_expression,
        $.call_expression,
      ),

    not_operator: $ => prec(PREC.not, seq(
      'not',
      field('argument', $.expression),
    )),

    boolean_operator: $ => choice(
      prec.left(PREC.and, seq(
        field('left', $.expression),
        field('operator', '&&'),
        field('right', $.expression),
      )),
      prec.left(PREC.or, seq(
        field('left', $.expression),
        field('operator', '||'),
        field('right', $.expression),
      )),
    ),

    binary_operator: $ => {
      const table = [
        ['+', PREC.plus],
        ['-', PREC.plus],
        ['*', PREC.times],
        ['/', PREC.times],
        ['|', PREC.bitwise_or],
        ['&', PREC.bitwise_and],
      ];

      return choice(...table.map(([operator, precedence]) => prec.left(precedence, seq(
        field('left', $.primary_expression),
        // @ts-ignore
        field('operator', operator),
        field('right', $.primary_expression),
      ))));
    },

    unary_operator: $ => {
      const unary_operators = ['+', '-'];

      return choice(...unary_operators.map((operator) => prec(PREC.unary, seq(
        field('operator', token(operator)),
        field('argument', $.primary_expression),
      ))));
    },

    comparison_operator: $ => prec.left(PREC.compare, seq(
      field('left', $.primary_expression),
      repeat1(seq(
        field('operators',
          choice(
            '<',
            '<=',
            '==',
            '!=',
            '>=',
            '>',
            '=~',
            '!~',
          )),
        field('right', $.primary_expression),
      )),
    )),

    _operand: $ =>
      choice(
        $.identifier,
        $._literal,
        seq('(', $.expression, ')'),
      ),

    _call_operand: $ =>
      choice(
        $.builtin,
        $.qualified_identifier,
      ),

    index_expression: $ => seq($.primary_expression, $.index),

    selector_expression: $ => seq($.primary_expression, $.selector),

    call_expression: $ => seq($._call_operand, $.arguments),
    arguments: $ => seq('(', $.argument, repeat(seq(',', $.argument)), ')'),
    argument: $ => $.expression,

    selector: $ => seq(token.immediate('.'), choice($.identifier, $.simple_string_lit)),

    index: $ => seq(token.immediate('['), $.expression, ']'),

    _literal: $ =>
      choice(
        $.struct_lit,
        $.list_lit,
        $._string_lit,
        $.int_lit,
        $.float_lit,
        $.null,
        $.top_lit,
        $.bottom_lit,
        $.primitive,
      ),

    comment: () => token(choice(seq('//', /.*/))),
  },
});
