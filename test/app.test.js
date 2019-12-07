import Startup from '../src/app/Startup';
jest.mock('../src/app/Startup');

test('Ensure startup has an initial value', () => {
    require('../src/app');
    expect(Startup).toHaveBeenCalled();
})